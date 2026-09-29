export interface TabDef {
  id: string;
  label: string;
  badge?: number;
}

interface Props {
  tabs: TabDef[];
  active: string;
  onSelect: (id: string) => void;
}

export default function TabBar({ tabs, active, onSelect }: Props) {
  return (
    <nav className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={active === t.id ? "on" : ""} onClick={() => onSelect(t.id)}>
          {t.label}
          {t.badge ? <span className="badge">{t.badge}</span> : ""}
        </button>
      ))}
    </nav>
  );
}
