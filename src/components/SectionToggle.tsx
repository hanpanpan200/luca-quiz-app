interface Option {
  id: string;
  label: string;
}

interface Props {
  options: readonly Option[];
  value: string;
  onChange: (id: string) => void;
}

/** 页内二选一子模块切换（如 选择题 / 编程题） */
export default function SectionToggle({ options, value, onChange }: Props) {
  return (
    <div className="btn-row" style={{ marginTop: 0 }}>
      {options.map((o) => (
        <button key={o.id} className={`btn small ${value === o.id ? "" : "ghost"}`}
          onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
