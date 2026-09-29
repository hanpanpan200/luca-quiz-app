import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AiApp from "../screens/ai/AiApp";
import { PROG_TIME_LIMIT_SEC } from "../data/programming";

beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });

it(`复现：超时(限${PROG_TIME_LIMIT_SEC}s)后横幅提示 + 错题本·编程题子模块可见`, () => {
  vi.useFakeTimers();
  render(<MemoryRouter initialEntries={["/ai/practice"]}><AiApp /></MemoryRouter>);

  fireEvent.click(screen.getByRole("tab", { name: /编程题/ }));
  fireEvent.click(screen.getByRole("button", { name: /节能台灯/ }));
  fireEvent.click(screen.getByRole("button", { name: /开始计时/ }));

  act(() => { vi.advanceTimersByTime(PROG_TIME_LIMIT_SEC * 1000 + 1500); });

  fireEvent.click(screen.getByRole("button", { name: /我做完了/ }));
  const banner = screen.getByText(/已进错题本|完成！/).textContent;
  console.log("横幅显示：", banner);

  // 走导航去错题本（与应用内点击一致）
  fireEvent.click(screen.getAllByRole("button").find((b) => b.closest("nav.tabs") && b.textContent?.includes("错题本"))!);
  fireEvent.click(screen.getByRole("tab", { name: /编程题/ }));
  const task = screen.queryByText(/节能台灯/);
  console.log("错题本·编程题中的节能台灯：", task ? "可见 ✓" : "❌ 不可见");
  expect(task).toBeInTheDocument();
  vi.useRealTimers();
});
