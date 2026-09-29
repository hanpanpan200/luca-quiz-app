import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
});
