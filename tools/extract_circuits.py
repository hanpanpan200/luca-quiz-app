"""从老师发的电路拼装 PDF 提取 60 题的题目文本、电路图与考点分类。

用法：python tools/extract_circuits.py [pdf路径]
输出：public/assets/circuits/qNN.png（按渲染页裁剪，天然应用变换矩阵）+ src/data/circuits.json

原理：pdftohtml -xml 提供每段文字/每张图的坐标。
- 同一物理行的文字 run 先按坐标合并成逻辑行（题号可能被拆成独立 run）
- 双栏版式中，每张电路图归属同栏中位于其上方最近的题号标题
- q55 的演示步骤「1. 2.」会伪装成题号：同号保留最早页的出现即可去重
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
DEFAULT_PDF = Path("/Users/grace/Downloads/2024电路基础拼装(1-3年级）.pdf")
OUT_DIR = PROJECT / "public" / "assets" / "circuits"

TIME_LIMIT_SEC = 180

CATEGORIES = [
    {"id": "switch-logic", "name": "电键组合逻辑", "emoji": "🔀"},
    {"id": "sensor", "name": "传感器触发", "emoji": "🧲"},
    {"id": "sound-light", "name": "声光电路", "emoji": "🔊"},
    {"id": "capacitor", "name": "电容延时", "emoji": "🔋"},
    {"id": "potentiometer", "name": "电位器调节", "emoji": "🎚️"},
    {"id": "oscillator", "name": "振荡与闪灯", "emoji": "💡"},
    {"id": "amplifier", "name": "功放与话筒", "emoji": "🎤"},
    {"id": "comprehensive", "name": "综合识图", "emoji": "🧩"},
]

# 题号 → 考点（设计文档附录 A）
CATEGORY_BY_NO = {
    **dict.fromkeys([1, 2, 3, 4, 5, 8, 9, 46, 50, 56], "switch-logic"),
    **dict.fromkeys([6, 7, 11, 15, 21, 26, 38, 51, 55], "sensor"),
    **dict.fromkeys([10, 12, 14, 16, 17, 37], "sound-light"),
    **dict.fromkeys([18, 22, 23, 24, 27, 28, 41, 44, 52, 54, 59], "capacitor"),
    **dict.fromkeys([20, 25, 29, 33, 49], "potentiometer"),
    **dict.fromkeys([30, 31, 32, 34, 39, 43, 53], "oscillator"),
    **dict.fromkeys([35, 40, 42], "amplifier"),
    **dict.fromkeys([13, 19, 36, 45, 47, 48, 57, 58, 60], "comprehensive"),
}

HEADER_RE = re.compile(r"^(\d{1,2})[.、．]")


def merge_lines(texts: list) -> list:
    """把同一物理行（同栏且 top 相差 ≤6px）的 runs 按 left 排序合并成逻辑行。"""
    lines = []
    for t in sorted(texts, key=lambda x: (x["top"], x["left"])):
        for ln in lines:
            if ln["col"] == t["col"] and abs(ln["top"] - t["top"]) <= 6:
                ln["runs"].append(t)
                break
        else:
            lines.append({"top": t["top"], "col": t["col"], "runs": [t]})
    out = []
    for ln in lines:
        runs = sorted(ln["runs"], key=lambda x: x["left"])
        out.append({
            "top": ln["top"],
            "left": runs[0]["left"],
            "col": runs[0]["col"],
            "text": " ".join(r["text"] for r in runs),
            "runs": runs,
        })
    return sorted(out, key=lambda x: (x["top"], x["left"]))


def parse_pdf(pdf: Path) -> list:
    """跑 pdftohtml 取几何 + pdftoppm 渲染页面，返回每页 {headers, lines, images}。

    图片一律从渲染页按 XML 坐标裁剪：渲染天然应用全部变换矩阵
    （pdftohtml 对负高度等复杂变换对象写出的嵌入流与实际绘制内容不符）。
    """
    tmp = Path(tempfile.mkdtemp(prefix="circuits_xml_"))
    subprocess.run(["pdftohtml", "-xml", str(pdf), str(tmp / "doc")], check=True, capture_output=True)
    root = ET.parse(next(tmp.glob("doc*.xml"))).getroot()
    dpi = 200
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(dpi), str(pdf), str(tmp / "page")],
        check=True, capture_output=True,
    )
    pages = []
    for pno, page in enumerate(root.findall("page"), start=1):
        mid = int(page.get("width")) / 2
        pw, ph = int(page.get("width")), int(page.get("height"))
        texts, images = [], []
        for el in page:
            if el.tag != "image":
                continue
            col = "L" if int(el.get("left", 0)) < mid else "R"
            left, top = int(el.get("left")), int(el.get("top"))
            w, h = int(el.get("width")), int(el.get("height"))
            images.append({
                "top": top, "col": col,
                "w": abs(w), "h": abs(h),
                "left": left, "page_no": pno,
            })
        # 文字单独一轮（保持原有顺序处理）
        for el in page:
            if el.tag != "text":
                continue
            col = "L" if int(el.get("left", 0)) < mid else "R"
            content = "".join(el.itertext()).strip()
            # 页脚页码（top>1150 的纯数字行）不是题文
            if content and not (int(el.get("top")) > 1150 and re.fullmatch(r"\d{1,2}", content)):
                texts.append({"top": int(el.get("top")), "left": int(el.get("left")), "col": col, "text": content})
        headers = []
        for ln in merge_lines(texts):
            m = HEADER_RE.match(ln["text"].replace(" ", ""))
            if m and 1 <= int(m.group(1)) <= 60:
                headers.append({"no": int(m.group(1)), "top": ln["top"], "col": ln["col"]})
        # 页内同号去重（保留上方那个）
        seen, dedup = set(), []
        for h in sorted(headers, key=lambda x: x["top"]):
            if h["no"] not in seen:
                seen.add(h["no"])
                dedup.append(h)
        pages.append({
            "headers": dedup, "lines": merge_lines(texts), "texts": texts,
            "images": images, "tmp": tmp, "dpi": dpi, "pw": pw, "ph": ph,
        })
    return pages


def main() -> None:
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    pages = parse_pdf(pdf)
    tmp = pages[0]["tmp"]

    # 全局题号去重：同号保留最早页（q55 的步骤 1./2. 在 p11，真 1/2 在 p1）
    seen_nos = set()
    for page in pages:
        page["headers"] = [h for h in page["headers"] if not (h["no"] in seen_nos or seen_nos.add(h["no"]))]
    all_nos = sorted({h["no"] for p in pages for h in p["headers"]})
    assert all_nos == list(range(1, 61)), f"题号不完整：缺失 {sorted(set(range(1, 61)) - set(all_nos))}"

    # 图片归属：全文档按 (页, 栏, top) 视作连续栏流（题块可跨页跨栏延伸，
    # 如 q12 的图溢出到下一页栏顶）。顺序遍历，图归属于流中最近的上一个标题。
    qimg = {}
    orphan_cnt = 0
    last_header = None
    for page in pages:
        for col in ("L", "R"):
            col_headers = sorted([h for h in page["headers"] if h["col"] == col], key=lambda h: h["top"])
            col_images = sorted([i for i in page["images"] if i["col"] == col], key=lambda i: i["top"])
            items = sorted(
                [{"kind": "h", **h} for h in col_headers] + [{"kind": "i", **i} for i in col_images],
                key=lambda x: x["top"],
            )
            for item in items:
                if item["kind"] == "h":
                    last_header = item["no"]
                else:
                    if last_header is None:
                        orphan_cnt += 1
                        continue
                    area = item["w"] * item["h"]
                    if last_header not in qimg or area > qimg[last_header]["w"] * qimg[last_header]["h"]:
                        qimg[last_header] = item

    # 文字归属：与图片相同的全栏流逻辑（页→栏→top 连续遍历，行归流中最近的上一个
    # 标题）——题块可跨页跨栏延伸，页内几何法会把跨界的尾行分错给邻题
    texts = {no: [] for no in all_nos}
    last_header = None
    for page in pages:
        for col in ("L", "R"):
            col_headers = sorted([h for h in page["headers"] if h["col"] == col], key=lambda h: h["top"])
            col_lines = sorted([ln for ln in page["lines"] if ln["col"] == col], key=lambda ln: ln["top"])
            items = sorted(
                [{"kind": "h", **h} for h in col_headers] + [{"kind": "t", **ln} for ln in col_lines],
                key=lambda x: x["top"],
            )
            for item in items:
                if item["kind"] == "h":
                    last_header = item["no"]
                elif last_header is not None:
                    texts[last_header].append(item["text"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    from PIL import Image

    rendered: dict[int, Image.Image] = {}
    questions = []
    for no in all_nos:
        text = re.sub(r"\s+", "", "".join(texts[no]))
        img = qimg.get(no)
        image = None
        if img:
            # 从渲染页按 XML 坐标裁剪（变换矩阵已由渲染正确应用）
            if img["page_no"] not in rendered:
                rendered[img["page_no"]] = Image.open(
                    tmp / f"page-{img['page_no']:02d}.png" if (tmp / f"page-{img['page_no']:02d}.png").exists()
                    else tmp / f"page-{img['page_no']}.png"
                )
            page_im = rendered[img["page_no"]]
            pw, ph = pages[img["page_no"] - 1]["pw"], pages[img["page_no"] - 1]["ph"]
            sx, sy = page_im.width / pw, page_im.height / ph
            box = (int(img["left"] * sx), int(img["top"] * sy),
                   int((img["left"] + img["w"]) * sx), int((img["top"] + img["h"]) * sy))
            page_im.crop(box).save(OUT_DIR / f"q{no:02d}.png")
            image = f"assets/circuits/q{no:02d}.png"
        questions.append({"id": f"c{no:02d}", "no": no, "text": text, "category": CATEGORY_BY_NO[no], "image": image})

    data = {
        "generated_at": date.today().isoformat(),
        "time_limit_sec": TIME_LIMIT_SEC,
        "categories": CATEGORIES,
        "questions": questions,
    }
    out = PROJECT / "src" / "data" / "circuits.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    with_img = sum(1 for q in questions if q["image"])
    print(f"✅ {out.name}：{len(questions)} 题，配图 {with_img}，无图 {len(questions) - with_img}")
    print(f"   未归属图片 {orphan_cnt} 张；无图题号 {[q['no'] for q in questions if not q['image']]}")
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
