import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QUESTIONS } from "../data";
import AiApp from "../screens/ai/AiApp";
import ChipApp from "../screens/chip/ChipApp";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("AI 模块交互流", () => {
  it("练习：选题库→选章节→答题→出现对错反馈", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/ai/practice"]}><AiApp /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: /基础版/ }));
    await user.click(screen.getByRole("button", { name: /芯片原理/ }));

    const firstOpt = document.querySelector(".opt") as HTMLElement;
    expect(firstOpt).toBeTruthy();
    await user.click(firstOpt);

    expect(await screen.findByText(/答对啦|答错啦/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /下一题/ }));
    expect(screen.queryByText(/答对啦|答错啦/)).not.toBeInTheDocument(); // 新题无反馈
  });

  it("模拟考：交卷后错题展示同时标出正确答案 ✅ 和考试时选错的选项 ❌", () => {
    render(<MemoryRouter initialEntries={["/ai/exam"]}><AiApp /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /开始考试/ }));

    // 每题都选一个错误选项（正确答案的下一个），确保全部进错题展示
    const all = QUESTIONS.banks.flatMap((b) => b.questions);
    for (let k = 0; k < 20; k++) {
      const text = document.querySelector(".q-text")?.textContent ?? "";
      const q = all.find((x) => x.text === text)!;
      const wrongIdx = ("ABCD".indexOf(q.answer) + 1) % 4;
      fireEvent.click(document.querySelectorAll(".opt")[wrongIdx]); // 选完自动进下一题
    }
    fireEvent.click(screen.getByRole("button", { name: /交卷/ }));

    expect(screen.getByText(/这几题答错了/)).toBeInTheDocument();
    const rows = document.querySelectorAll(".study-q");
    expect(rows.length).toBe(20);
    for (const row of rows) {
      expect(row.querySelector("li.correct")).toBeTruthy(); // 正确答案 ✅
      expect(row.querySelector("li.wrong")?.textContent).toContain("你选的"); // 考试时选错的 ❌
    }
  });

  it("模拟考：未作答的题交卷后带「未作答」标记", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true); // 允许带空题交卷
    render(<MemoryRouter initialEntries={["/ai/exam"]}><AiApp /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /开始考试/ }));

    const all = QUESTIONS.banks.flatMap((b) => b.questions);
    fireEvent.click(screen.getByRole("button", { name: /下一题/ })); // 第 1 题空着跳过
    for (let k = 1; k < 20; k++) {
      const text = document.querySelector(".q-text")?.textContent ?? "";
      const q = all.find((x) => x.text === text)!;
      const wrongIdx = ("ABCD".indexOf(q.answer) + 1) % 4;
      fireEvent.click(document.querySelectorAll(".opt")[wrongIdx]);
    }
    fireEvent.click(screen.getByRole("button", { name: /交卷/ }));

    expect(screen.getByText("未作答")).toBeInTheDocument();
    expect(document.querySelector(".study-q")?.querySelector("li.wrong")).toBeNull(); // 第一题空着：只有未作答标记，没有选错标记
  });
});

describe("chip 模块交互流", () => {
  it("练习：开始计时→超时→我做完了→进超时本→tab角标", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/chip/chipPractice"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /电容延时/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));

    act(() => { vi.advanceTimersByTime(181_000); }); // 超过 180 秒

    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    expect(screen.getByText(/已进超时本/)).toBeInTheDocument();

    // 超时本 tab 出现角标 1
    const wrongTab = screen.getAllByText(/超时本/).find((el) => el.tagName === "BUTTON");
    expect(wrongTab?.textContent).toContain("1");
    vi.useRealTimers();
  });

  it("练习：3 分钟内完成不进超时本", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/chip/chipPractice"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /电容延时/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));

    act(() => { vi.advanceTimersByTime(90_000); }); // 1.5 分钟

    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    expect(screen.getByText(/完成！/)).toBeInTheDocument();
    const wrongTab2 = screen.getAllByText(/超时本/).find((el) => el.tagName === "BUTTON");
    expect(wrongTab2?.textContent).not.toContain("1");
    vi.useRealTimers();
  });

  it("练习：按题号 1~2 练习，顺序出题", () => {
    render(<MemoryRouter initialEntries={["/chip/chipPractice"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /按题号/ }));
    fireEvent.change(screen.getByLabelText(/起始题号/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/结束题号/), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /开始练习/ }));

    expect(screen.getByText(/第 1 \/ 2 题/)).toBeInTheDocument();
    expect(screen.getByText(/^第 1 题 ·/)).toBeInTheDocument(); // 当前显示第1题
  });

  it("开始计时首帧即 0:00，不闪负数（准备 60 秒后再开始）", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/chip/chipPractice"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /电容延时/ }));
    act(() => { vi.advanceTimersByTime(60_000); }); // 孩子看题准备 60 秒，期间 now 状态过期

    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));
    const clock = document.querySelector(".score-hero .num");
    expect(clock?.textContent).toBe("0:00"); // 首帧必须是 0:00，而不是 -1:57 之类的负数
    vi.useRealTimers();
  });

  it("练习：题号范围非法时开始按钮禁用", () => {
    render(<MemoryRouter initialEntries={["/chip/chipPractice"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /按题号/ }));
    fireEvent.change(screen.getByLabelText(/起始题号/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/结束题号/), { target: { value: "3" } }); // 起>止

    expect(screen.getByRole("button", { name: /开始练习/ })).toBeDisabled();
  });

  it("练习：做完的题计入成绩单（两题都完成后 2/2，不再显示 0/2）", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/chip/chipPractice"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /按题号/ }));
    fireEvent.change(screen.getByLabelText(/起始题号/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/结束题号/), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /开始练习/ }));

    for (let q = 1; q <= 2; q++) {
      act(() => { vi.advanceTimersByTime(700); }); // 过防误触锁（开题/翻题后按钮暂锁）
      fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));
      act(() => { vi.advanceTimersByTime(90_000); });
      fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
      act(() => { vi.advanceTimersByTime(700); });
      if (q === 1) fireEvent.click(screen.getByRole("button", { name: /下一题/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: /看结果/ }));

    expect(screen.getByText(/本轮练习完成/)).toBeInTheDocument();
    expect(document.querySelector(".score-hero")?.textContent).toContain("2 / 2 题");
    vi.useRealTimers();
  });

  it("练习：做完一题后可一键「结束练习」，不必点完剩下的题", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/chip/chipPractice"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /按题号/ }));
    fireEvent.change(screen.getByLabelText(/起始题号/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/结束题号/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /开始练习/ }));

    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));
    act(() => { vi.advanceTimersByTime(60_000); });
    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.click(screen.getByRole("button", { name: /结束练习/ }));

    expect(screen.getByText(/本轮练习完成/)).toBeInTheDocument();
    expect(document.querySelector(".score-hero")?.textContent).toContain("1 / 5 题");
    vi.useRealTimers();
  });

  it("练习：连点「我做完了」多出的几下不会串到下一屏按钮（防误触锁）", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/chip/chipPractice"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /按题号/ }));
    fireEvent.change(screen.getByLabelText(/起始题号/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/结束题号/), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /开始练习/ }));

    // 计时中锁过期后才点「我做完了」——此后立刻连点刚出现的「下一题」
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));

    // 锁定窗口内「下一题」点不动（disabled），仍在第 1 题
    const next = screen.getByRole("button", { name: /下一题/ });
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(screen.getByText(/第 1 \/ 2 题/)).toBeInTheDocument();

    // 锁过期后可正常翻题
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.click(screen.getByRole("button", { name: /下一题/ }));
    expect(screen.getByText(/第 2 \/ 2 题/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("模拟考：成绩单「再来一场」重新抽题，从第 1 题重新开始", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/chip/chipExam"]}><ChipApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /开始考试/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));
    act(() => { vi.advanceTimersByTime(10_000); });
    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.click(screen.getByRole("button", { name: /结束考试/ }));

    expect(screen.getByText(/模拟考成绩单/)).toBeInTheDocument();
    expect(document.querySelector(".score-hero")?.textContent).toContain("1 / 4 题"); // 只做了1题

    // 提前进考试也要留下本场记录（times_ms 含未做的 null）
    const saved = JSON.parse(localStorage.getItem("swcode_chip_v1") || "{}");
    expect(saved.exam_history).toHaveLength(1);
    expect(saved.exam_history[0].times_ms).toEqual([10000, null, null, null]);

    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.click(screen.getByRole("button", { name: /再来一场/ }));
    expect(screen.getByText(/第 1 \/ 4 题/)).toBeInTheDocument(); // 新一场从头开始
    vi.useRealTimers();
  });
});
