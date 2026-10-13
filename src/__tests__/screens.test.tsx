import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomeScreen from "../screens/HomeScreen";

describe("主页", () => {
  it("上下分区：即将开始只放 AI 实物编程，已结束放电子创芯赛", () => {
    render(<MemoryRouter><HomeScreen /></MemoryRouter>);

    const upcoming = screen.getByRole("heading", { name: "🚀 即将开始" }).closest("section");
    expect(upcoming).not.toBeNull();
    expect(within(upcoming!).getByText("AI 实物编程")).toBeInTheDocument();
    expect(within(upcoming!).queryByText("电子创芯赛")).not.toBeInTheDocument();

    const ended = screen.getByRole("heading", { name: "🏁 已结束" }).closest("section");
    expect(ended).not.toBeNull();
    expect(within(ended!).getByText("电子创芯赛")).toBeInTheDocument();
    expect(within(ended!).queryByText("AI 实物编程")).not.toBeInTheDocument();
    // 已结束的徽标
    expect(within(ended!).getByText("已结束")).toBeInTheDocument();
    // 已结束仍可点击（保留复习入口）
    expect(within(ended!).getByRole("button", { name: /电子创芯赛/ })).toBeEnabled();
  });
});
