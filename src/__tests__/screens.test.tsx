import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomeScreen from "../screens/HomeScreen";

describe("主页", () => {
  it("包含电子创芯赛和 AI 实物编程两个入口", () => {
    render(<MemoryRouter><HomeScreen /></MemoryRouter>);
    expect(screen.getByText("电子创芯赛")).toBeInTheDocument();
    expect(screen.getByText("AI 实物编程")).toBeInTheDocument();
  });
});
