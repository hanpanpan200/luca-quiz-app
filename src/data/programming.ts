export interface ProgrammingTask {
  id: string;
  no: number;
  name: string;
  tier: "basic" | "advanced";
  description: string;
  focus: string;
  structure: string;
}

/** 2026 浙江省赛编程任务（5 基础 + 5 进阶），10 分钟限时搭建 */
export const PROGRAMMING_TASKS: ProgrammingTask[] = [
  {
    id: "p1", no: 1, name: "节能台灯", tier: "basic",
    description: "当光线较暗且台灯前有人时，灯光才会打开。",
    focus: "逻辑「非」「与」、LED 模块、红外传感器",
    structure: "搭建一个合理且美观的台灯造型",
  },
  {
    id: "p2", no: 2, name: "走廊灯", tier: "basic",
    description: "只要按下两个按钮中的一个，LED 灯就会亮起数秒后熄灭。",
    focus: "逻辑「或」、延时、按键模块",
    structure: "搭建一个合理且美观的走廊灯造型",
  },
  {
    id: "p3", no: 3, name: "智能防盗门", tier: "basic",
    description: "当门被打开（磁控开关断开或光线传感器的数值发生变化）时，蜂鸣器就会响起。",
    focus: "逻辑「非」、磁控开关或光线传感器、蜂鸣器",
    structure: "搭建一个合理且美观的防盗门造型",
  },
  {
    id: "p4", no: 4, name: "可变光控灯", tier: "basic",
    description: "按钮按下、光线变暗时 LED 才会发光；按钮抬起或光线亮的时候 LED 不发光。",
    focus: "逻辑「与」「非」、按键模块、光敏传感器、LED 模块",
    structure: "搭建一个合理且美观的可变光控灯造型",
  },
  {
    id: "p5", no: 5, name: "怕黑小车", tier: "basic",
    description: "当光照亮度很低的时候，小车会逃走。",
    focus: "逻辑「非」、电机驱动模块",
    structure: "搭建一个合理且可行驶的小车机械造型",
  },
  {
    id: "p6", no: 6, name: "试衣室门禁", tier: "advanced",
    description: "为商场试衣室设计智能提示系统。功能一：门内按钮按下且磁控开关闭合（表示「里面有人」）亮红灯，不同时满足则红灯熄灭。功能二：外侧按钮按下，亮黄灯并蜂鸣器响起（表示「外面有人等」）。",
    focus: "逻辑「拓展」「锁存」、磁控开关、按键、LED、蜂鸣器、延时模块",
    structure: "搭建一个合理且便于开关的试衣室门禁造型",
  },
  {
    id: "p7", no: 7, name: "高铁洗手间提醒系统", tier: "advanced",
    description: "当磁控开关闭合或光敏传感器数值发生变化，且红外感应器感应到有人时，门外红灯才亮起；否则亮绿灯。",
    focus: "逻辑「与」「非」「拓展」、磁控开关、红外传感器、LED 模块",
    structure: "搭建一个合理且可方便开关的高铁洗手间提醒系统造型",
  },
  {
    id: "p8", no: 8, name: "金库安保", tier: "advanced",
    description: "只有两个开关同时按下时绿灯亮（安全打开）；只按下一个时红灯亮且蜂鸣器响（触发警报）。",
    focus: "逻辑「与」「异或」「非」、按键模块、LED 模块、蜂鸣器模块、连线、终端模块",
    structure: "搭建一个合理且美观的金库造型",
  },
  {
    id: "p9", no: 9, name: "自动晾衣架", tier: "advanced",
    description: "当天黑或下雨时，衣架自动收回来；天亮或雨停了，衣架会再次伸出去。",
    focus: "逻辑「或」「非」、电机模块、电机、雨滴传感器、光线传感器",
    structure: "搭建一个使用齿轮齿条配合的结构，实现晾衣架自动伸缩",
  },
  {
    id: "p10", no: 10, name: "智能楼道灯", tier: "advanced",
    description: "当环境光线暗并且有人（或有人按按键）时，自动点亮 LED 灯，并带延时功能。",
    focus: "逻辑「与」「或」「非」的组合应用、延时、按键模块、红外模块、LED 模块",
    structure: "搭建一个合理且美观的楼道灯造型",
  },
];

export const PROG_TIME_LIMIT_SEC = 600; // 10 分钟
