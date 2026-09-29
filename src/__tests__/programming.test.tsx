import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AiApp from "../screens/ai/AiApp";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("AI 编程题模块", () => {
  it("列表分组展示 5 道基础任务 + 1 道进阶任务", () => {
    render(<MemoryRouter initialEntries={["/ai/prog"]}><AiApp /></MemoryRouter>);

    for (const name of ["节能台灯", "走廊灯", "智能防盗门", "可变光控灯", "怕黑小车", "试衣室门禁"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByText(/基础任务/)).toBeInTheDocument();
    expect(screen.getByText(/进阶任务/)).toBeInTheDocument();
  });

  it("开始计时→超 10 分钟→完成进错题本（任务卡标记超时中）", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/ai/prog"]}><AiApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /节能台灯/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));

    act(() => { vi.advanceTimersByTime(10 * 60_000 + 1_000); }); // 10 分 01 秒

    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    expect(screen.getByText(/已进错题本/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /返回任务列表/ }));
    expect(screen.getByText(/超时中/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("10 分钟内完成不进错题本", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/ai/prog"]}><AiApp /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /走廊灯/ }));
    fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));

    act(() => { vi.advanceTimersByTime(8 * 60_000); }); // 8 分钟

    fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
    expect(screen.getByText(/完成！/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /返回任务列表/ }));
    expect(screen.queryByText(/超时中/)).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
