interface Option {
  id: string;
  label: string;
}

interface Props {
  options: readonly Option[];
  value: string;
  onChange: (id: string) => void;
}

/** 页内子模块分段控制器（如 选择题 / 编程题）——视觉层级低于主导航 */
export default function SectionToggle({ options, value, onChange }: Props) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id}
          className={value === o.id ? "on" : ""}
          onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
