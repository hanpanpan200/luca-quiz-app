"""从老师发的电路拼装 Word 原稿（docx）直接提取 60 题的电路图。

用法：python tools/extract_circuits_docx.py [docx路径]
输出：public/assets/circuits/qNN.png（覆盖 PDF 裁剪版，分辨率更高且无渲染伪影）

与 extract_circuits.py（PDF 渲染裁剪）的关系：本脚本改从 docx 内嵌媒体原样取图。
- 位图（png/jpeg）按原始像素导出，并应用 Word 里的裁剪（a:srcRect，百分比）
- 矢量图（wmf/emf，本册 .emf 实为 placeable WMF）经 Windows GDI+（PowerShell）
  按 Word 显示尺寸 ×3 栅格化，纵横比与纸质稿/旧图一致
- WMF/EMF 在 WSL 内无可用栅格化器，借道 interop 调 powershell.exe + System.Drawing

docx 结构要点（word/document.xml，剔除 mc:Fallback 与墨迹批注后按文档流遍历）：
- 题头两类：明文题号（"1."/"2、"）与 Word 自动编号段（XML 中无题号文本，靠
  AUTO_HEADERS 里人工核对过的段前缀补号）
- 图片归属文档流中最近的上一个题头（题头段内嵌的图归该题，如 q2/q10/q22）
- q20-q24 区排版错乱：XML 顺序为 22 题(内嵌 image21)→23 题正文→21 题正文→
  image22→image23，按 REMAP 修正（与旧 PDF 裁剪图纵横比逐一核对：
  image22 显示 288×228=1.263 ≈ 旧 q21 1.264；image23 显示 283×202=1.405 ≈ 旧 q23 284×202）
- image58.png 为 4×3 透明占位图、无任何引用（孤儿文件）；q58 的图实际是 image59
"""
import json
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
DEFAULT_DOCX = PROJECT / "raw" / "2024电路基础拼装(1-3年级）.docx"
OUT_DIR = PROJECT / "public" / "assets" / "circuits"

# PowerShell 暂存目录（须 Windows 可见，GDI+ 才能直接读）
STAGE_DIR = Path("/mnt/c/Users/admin/AppData/Local/Temp/circuits_docx_extract")
PS_EXE = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"

EMU_PER_INCH = 914400
HEADER_RE = re.compile(r"^(\d{1,2})[.、．]")

# 自动编号题头段（XML 无题号文本）→ 题号；None 表示同文重复段，按出现顺序取 AUTO_SEQ 的号
AUTO_HEADERS = {
    "按下图拼搭，完成实验并演示效果。接通开关，电位器滑动杆向": 20,
    "按下图拼搭，完成实验并演示效果。接通开关，按下电键电风扇": 23,
    "识图搭建，并演示电路功能，可调延时闪发电路": 31,
    "识图拼一个电喇叭电路": 35,
    "识图完成拼搭，显示电路功能。": None,  # q47/q48 同文重复
    "接通开关，可变电阻向下滑动": 49,
    "接通开关，两个灯泡": 50,
}
AUTO_SEQ = {"识图完成拼搭，显示电路功能。": [47, 48]}
# 文档流归属纠偏（见模块 docstring）
REMAP = {21: "image22.emf", 23: "image23.wmf"}

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
V = "{urn:schemas-microsoft-com:vml}"
WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
MC = "{http://schemas.openxmlformats.org/markup-compatibility/2006}"


def detect_header(text: str, auto_seq: dict) -> int | None:
    """段文本 → 题号：明文题号优先，否则查自动编号段前缀表。"""
    m = HEADER_RE.match(text)
    if m and 1 <= int(m.group(1)) <= 60:
        return int(m.group(1))
    for prefix, qno in AUTO_HEADERS.items():
        if text.startswith(prefix):
            if qno is None:
                seq = auto_seq.get(prefix)
                return seq.pop(0) if seq else None
            return qno
    return None


def strip_fallback(xml: str) -> str:
    """删除 mc:Fallback 子树（其 VML 兜底与 DrawingML 主干重复引用同一媒体）。"""
    while "<mc:Fallback>" in xml:
        s = xml.find("<mc:Fallback>")
        i = s
        while True:
            n1, n2 = xml.find("<mc:Fallback>", i + 1), xml.find("</mc:Fallback>", i + 1)
            if n1 != -1 and n1 < n2:
                i = n1
            else:
                e = n2
                break
        xml = xml[:s] + xml[e + len("</mc:Fallback>"):]
    return xml


def parse_vml_sizes(xml: str, rels: dict) -> dict:
    """v:shape style 的 width/height(pt) → media 显示像素 @96dpi。"""
    disp = {}
    for m in re.finditer(
        r'<v:shape\b[^>]*?style="([^"]+)"[^>]*>(?:(?!</v:shape>).)*?<v:imagedata[^>]*r:id="(rId\d+)"',
        xml, re.S,
    ):
        style, rid = m.groups()
        w = re.search(r"width:([\d.]+)pt", style)
        h = re.search(r"height:([\d.]+)pt", style)
        if rels.get(rid) and w and h:
            disp[rels[rid]] = (round(float(w.group(1)) * 96 / 72), round(float(h.group(1)) * 96 / 72))
    return disp


def para_pics(p, rels: dict, vml_disp: dict) -> list:
    """段落内图片 → [{media, crop, tw, th}]，跳过 mc:Fallback 与墨迹批注。"""
    out = []

    def add(media, crop, tw=0, th=0):
        if media:
            out.append({"media": media, "crop": crop, "tw": tw, "th": th})

    def walk(el, in_fallback):
        if in_fallback:
            return
        if el.tag in (f"{WP}inline", f"{WP}anchor"):
            gdata = el.find(f".//{A}graphicData")
            if gdata is not None and "Ink" in (gdata.get("uri") or ""):
                return  # 墨迹批注（如 q58 段内的「墨迹 7」）不是电路图
            bf = el.find(f".//{A}blipFill")
            blip = (bf or el).find(f".//{A}blip")
            if blip is not None:
                crop = {}
                if bf is not None:
                    sr = bf.find(f"{A}srcRect")
                    if sr is not None:
                        for k in ("l", "t", "r", "b"):
                            if sr.get(k) is not None:
                                crop[k] = int(sr.get(k)) / 100000
                ext = el.find(f"{WP}extent")
                tw = round(int(ext.get("cx")) / EMU_PER_INCH * 96) if ext is not None else 0
                th = round(int(ext.get("cy")) / EMU_PER_INCH * 96) if ext is not None else 0
                add(rels.get(blip.get(f"{R}embed")), crop, tw, th)
            return
        if el.tag == f"{V}imagedata":
            media = rels.get(el.get(f"{R}id"))
            tw, th = vml_disp.get(media, (0, 0))
            add(media, {}, tw, th)
        for c in el:
            walk(c, in_fallback or c.tag == f"{MC}Fallback")

    walk(p, False)
    return out


def parse_docx(docx: Path) -> dict:
    """文档流归属：图归最近的上一个题头。返回 {题号: {media, crop, tw, th}}。"""
    zf = zipfile.ZipFile(docx)
    rels = {
        rel.get("Id"): rel.get("Target")
        for rel in ET.fromstring(zf.read("word/_rels/document.xml.rels"))
        if "image" in rel.get("Type", "")
    }
    root = ET.fromstring(zf.read("word/document.xml"))
    vml_disp = parse_vml_sizes(
        strip_fallback(zf.read("word/document.xml").decode("utf-8")), rels)

    auto_seq = {k: list(v) for k, v in AUTO_SEQ.items()}
    by_q, seen = {no: [] for no in range(1, 61)}, set()
    last = None
    for p in root.iter(f"{W}p"):
        text = "".join(t.text or "" for t in p.iter(f"{W}t")).strip()
        no = detect_header(text, auto_seq)
        if no is not None:
            assert no not in seen, f"题号 {no} 出现两次"
            seen.add(no)
            last = no
        for pic in para_pics(p, rels, vml_disp):
            if last is not None:
                by_q[last].append(pic)
    assert seen == set(range(1, 61)), f"题号不完整：缺失 {sorted(set(range(1, 61)) - seen)}"

    result = {}
    for no in range(1, 61):
        cand = by_q[no]
        if no in REMAP:  # q21 多得一张、q23 缺图：按纵横比核对结果重分配
            name = REMAP[no]
            cand = [p for p in cand if Path(p["media"]).name == name] or [
                p for q in range(1, 61) for p in by_q[q]
                if Path(p["media"]).name == name
            ]
        assert cand, f"q{no:02d} 无图"
        result[no] = cand[0]
    used = {Path(v["media"]).name for v in result.values()}
    assert len(used) == 60, f"存在复用图片：{sorted(used)}"
    return result


RENDER_PS1 = r"""
param([string]$StageDir)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$manifest = Get-Content (Join-Path $StageDir 'manifest.json') -Raw | ConvertFrom-Json
$outDir = Join-Path $StageDir 'out'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
foreach ($e in $manifest) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $StageDir $e.src))
  try {
    if ($e.crop) {  # Word srcRect 裁剪：按原始像素裁
      $l = [double]$e.crop.l; $t = [double]$e.crop.t
      $r = [double]$e.crop.r; $b = [double]$e.crop.b
      $w = [int][Math]::Floor($img.Width  * (1.0 - $l - $r))
      $h = [int][Math]::Floor($img.Height * (1.0 - $t - $b))
      $rect = New-Object System.Drawing.Rectangle([int][Math]::Floor($img.Width * $l), [int][Math]::Floor($img.Height * $t), $w, $h)
      $cropped = $img.Clone($rect, $img.PixelFormat)
      $img.Dispose()
      $img = $cropped
    }
    if ($e.vector) {  # 矢量：按 Word 显示尺寸 x3 栅格化
      $tw = [int]($e.tw * 3); $th = [int]($e.th * 3)
      if ($tw -lt 50 -or $th -lt 50) { $tw = $img.Width * 2; $th = $img.Height * 2 }
    } else {  # 位图：最长边不足 700 时整数倍放大（至多 x4）
      $k = [Math]::Ceiling(700.0 / [Math]::Max($img.Width, $img.Height))
      if ($k -lt 1) { $k = 1 }; if ($k -gt 4) { $k = 4 }
      $tw = [int]($img.Width * $k); $th = [int]($img.Height * $k)
    }
    $bmp = New-Object System.Drawing.Bitmap($tw, $th)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $tw, $th)
    $g.Dispose()
    $bmp.Save((Join-Path $outDir $e.out), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("OK " + $e.out)
  } finally { $img.Dispose() }
}
"""


def wslpath(posix: Path) -> str:
    return subprocess.run(["wslpath", "-w", str(posix)], check=True,
                          capture_output=True, text=True).stdout.strip()


def main() -> None:
    docx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DOCX
    qmap = parse_docx(docx)

    # 暂存到 Windows 可见目录，GDI+ 经 PowerShell 读取
    shutil.rmtree(STAGE_DIR, ignore_errors=True)
    (STAGE_DIR / "src").mkdir(parents=True)
    zf = zipfile.ZipFile(docx)
    manifest = []
    for no in sorted(qmap):
        p = qmap[no]
        suffix = Path(p["media"]).suffix
        staged = f"src/q{no:02d}{suffix}"
        (STAGE_DIR / staged).write_bytes(zf.read(f"word/{p['media']}"))
        manifest.append({
            "q": no, "src": staged, "out": f"q{no:02d}.png",
            "vector": suffix in (".wmf", ".emf"),
            "tw": p["tw"], "th": p["th"],
            "crop": p["crop"] or None,
        })
    (STAGE_DIR / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    # PS 5.1 无 BOM 会把脚本当 ANSI 读，中文注释须带 BOM
    (STAGE_DIR / "render.ps1").write_text(RENDER_PS1, encoding="utf-8-sig")

    print("调 PowerShell GDI+ 栅格化…")
    # 本机策略为 RemoteSigned，本地脚本可直接 -File 运行，无需改执行策略
    res = subprocess.run(
        [PS_EXE, "-NoProfile",
         "-File", wslpath(STAGE_DIR / "render.ps1"), wslpath(STAGE_DIR)],
        capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stdout)
        print(res.stderr)
        sys.exit("PowerShell 渲染失败")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    missing = [e["q"] for e in manifest
               if (STAGE_DIR / "out" / e["out"]).stat().st_size == 0]
    assert not missing, f"渲染缺图：{missing}"
    for e in manifest:
        shutil.copy(STAGE_DIR / "out" / e["out"], OUT_DIR / e["out"])

    vec = sum(1 for e in manifest if e["vector"])
    print(f"✅ 60 题图已更新至 {OUT_DIR}（矢量栅格化 {vec}，位图原样导出 {60 - vec}）")
    for e in manifest:
        note = f" 裁剪{l}" if (l := qmap[e["q"]]["crop"]) else ""
        print(f"  q{e['q']:02d} <- {Path(qmap[e['q']]['media']).name}{note}")


if __name__ == "__main__":
    sys.exit(main())
