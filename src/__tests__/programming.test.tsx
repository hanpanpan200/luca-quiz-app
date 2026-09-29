import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AiApp from "../screens/ai/AiApp";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

/** 进入某 tab 后切换到编程题子模块 */
function gotoProg() {
  fireEvent.click(screen.getByRole("tab", { name: /编程题/ }));
  expect(screen.getByRole("tab", { name: /选择题/ })).toBeInTheDocument();
}

describe("AI 编程题子模块（挂在各 tab 下）", () => {
  it("主 tab 仍是 5 个，tab 栏不含编程题（编程题是页内子模块）", () => {
    render(<MemoryRouter initialEntries={["/ai/study"]}><AiApp /></MemoryRouter>);
    const tabs = screen.getAllByRole("button").filter((b) => b.closest("nav.tabs"));
    expect(tabs.length).toBe(5);
    expect(tabs.map((b) => b.textContent).join("")).not.toContain("编程题");
  });

  it("学习页：切换编程题可见 6 个任务及考察重点", () => {
    render(<MemoryRouter initialEntries={["/ai/study"]}><AiApp /></MemoryRouter>);
    gotoProg();
    for (const name of ["节能台灯", "走廊灯", "智能防盗门", "可变光控灯", "怕黑小车", "试衣室门禁"]) {
      expect(screen.getAllByText(new RegExp(name)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/进阶任务/)).toBeInTheDocument();
  });

  it("练习页：计时→超 10 分钟→完成进错题本", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/ai/practice"]}><AiApp /></MemoryRouter>);
    gotoProg();

    fireEvent.click(screen.getByRole("button", { name: /节能台灯/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));

    act(() => { vi.advanceTimersByTime(10 * 60_000 + 1_000); });

    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    expect(screen.getByText(/已进错题本/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("练习页：10 分钟内完成不进错题本", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/ai/practice"]}><AiApp /></MemoryRouter>);
    gotoProg();

    fireEvent.click(screen.getByRole("button", { name: /走廊灯/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));

    act(() => { vi.advanceTimersByTime(8 * 60_000); });

    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    expect(screen.getByText(/完成！/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("错题本页：分选择题/编程题两个子模块，编程题超时任务可重练", () => {
    // 先制造一个超时记录
    vi.useFakeTimers();
    const { unmount } = render(<MemoryRouter initialEntries={["/ai/practice"]}><AiApp /></MemoryRouter>);
    gotoProg();
    fireEvent.click(screen.getByRole("button", { name: /怕黑小车/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));
    act(() => { vi.advanceTimersByTime(11 * 60_000); });
    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    unmount();
    vi.useRealTimers();

    render(<MemoryRouter initialEntries={["/ai/wrong"]}><AiApp /></MemoryRouter>);
    expect(screen.getByText(/错题本空空的/)).toBeInTheDocument(); // 选择题部分为空
    gotoProg();
    expect(screen.getByText(/怕黑小车/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /开练/ }));
    expect(screen.getByRole("button", { name: /开始计时/ })).toBeInTheDocument();
  });

  it("模拟考页：编程题模式随机抽 1 个任务开考", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/ai/exam"]}><AiApp /></MemoryRouter>);
    gotoProg();

    fireEvent.click(screen.getByRole("button", { name: /开始考试/ }));
    // 随机抽中某个任务，进入计时准备界面
    expect(screen.getByRole("button", { name: /开始计时/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("统计页：包含编程题任务板块，超时任务可见", () => {
    vi.useFakeTimers();
    const { unmount } = render(<MemoryRouter initialEntries={["/ai/practice"]}><AiApp /></MemoryRouter>);
    gotoProg();
    fireEvent.click(screen.getByRole("button", { name: /节能台灯/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));
    act(() => { vi.advanceTimersByTime(11 * 60_000); });
    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    unmount();
    vi.useRealTimers();

    render(<MemoryRouter initialEntries={["/ai/stats"]}><AiApp /></MemoryRouter>);
    expect(screen.getByText(/编程题任务/)).toBeInTheDocument();
    expect(screen.getByText(/已练 1\/6/)).toBeInTheDocument();
    expect(screen.getByText(/节能台灯/)).toBeInTheDocument();
    expect(screen.getAllByText(/⏰ 超时中/).length).toBeGreaterThan(0);
  });
});
