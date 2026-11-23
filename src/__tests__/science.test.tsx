import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SCIENCE_UNITS } from "../data/science";
import HomeScreen from "../screens/HomeScreen";
import ScienceApp from "../screens/science/ScienceApp";

const U2 = SCIENCE_UNITS.find((u) => u.id === "g3a-u2")!;

beforeEach(() => localStorage.clear());

describe("主页·校内复习入口", () => {
  it("「校内复习」分组在比赛分组之后、已结束之前，含科学入口", () => {
    render(<MemoryRouter><HomeScreen /></MemoryRouter>);

    const review = screen.getByRole("heading", { name: "📖 校内复习" }).closest("section");
    expect(review).not.toBeNull();
    expect(within(review!).getByText("科学")).toBeInTheDocument();

    const upcomingPos = screen.getByRole("heading", { name: "🚀 即将开始" }).compareDocumentPosition(review!);
    expect(upcomingPos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // 在「即将开始」后面

    const ended = screen.getByRole("heading", { name: "🏁 已结束" }).closest("section")!;
    const reviewPos = review!.compareDocumentPosition(ended);
    expect(reviewPos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // 在「已结束」前面
  });
});

describe("科学·单元列表与练习", () => {
  it("单元列表显示《水》单元及题数，点击进入单元", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/science"]}><ScienceApp /></MemoryRouter>);

    const tile = screen.getByRole("button", { name: /第二单元《水》/ });
    expect(tile.textContent).toContain(String(U2.questions.length));

    await user.click(tile);
    expect(screen.getByRole("button", { name: /✏️ 练习/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /🏆 模拟考/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /❌ 错题本/ })).toBeInTheDocument();
  });

  it("练习：选课→答题→显示对错反馈和解析，错题进错题本", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/science/g3a-u2/practice"]}><ScienceApp /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: /1、水到哪里去了/ }));

    // 故意选错：选正确答案的下一个选项
    const text = document.querySelector(".q-text")?.textContent ?? "";
    const q = U2.questions.find((x) => x.text === text)!;
    const wrongIdx = ("ABCD".indexOf(q.answer) + 1) % 4;
    fireEvent.click(document.querySelectorAll(".opt")[wrongIdx]);

    expect(await screen.findByText(/答错啦/)).toBeInTheDocument();
    expect(document.querySelector(".explain")?.textContent).toBe(`💡 ${q.explanation}`); // 解析显示

    // 错题本里有这道题
    fireEvent.click(screen.getByRole("button", { name: /❌ 错题本/ }));
    expect(screen.getByText(/开始重刷/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(q.text.slice(0, 8)))).toBeInTheDocument();
  });

  it("模拟考：出全部题且覆盖全部课，交卷出分且错题带解析", () => {
    render(<MemoryRouter initialEntries={["/science/g3a-u2/exam"]}><ScienceApp /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /开始考试/ }));

    expect(document.querySelectorAll(".dot").length).toBe(U2.questions.length);

    const seenChapters = new Set<string>();
    for (let k = 0; k < U2.questions.length; k++) {
      const text = document.querySelector(".q-text")?.textContent ?? "";
      const q = U2.questions.find((x) => x.text === text)!;
      seenChapters.add(q.chapter);
      const wrongIdx = ("ABCD".indexOf(q.answer) + 1) % 4;
      fireEvent.click(document.querySelectorAll(".opt")[wrongIdx]); // 全选错
    }
    expect(seenChapters.size).toBe(U2.chapters.length); // 每课都考到

    fireEvent.click(screen.getByRole("button", { name: /交卷/ }));

    expect(screen.getByText(/这几题答错了/)).toBeInTheDocument();
    const rows = document.querySelectorAll(".study-q");
    expect(rows.length).toBe(U2.questions.length);
    for (const row of rows) {
      expect(row.querySelector(".explain")).toBeTruthy(); // 每道错题都附解析
    }
    expect(document.querySelector(".score-hero .num")?.textContent).toContain("0"); // 全选错 = 0 分
  });
});
