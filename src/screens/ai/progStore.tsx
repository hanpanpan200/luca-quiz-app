import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadProgStore, saveProgStore } from "../../storage";
import type { ProgStore } from "../../types";

const ProgStoreContext = createContext<{ store: ProgStore; setStore: React.Dispatch<React.SetStateAction<ProgStore>> } | null>(null);

/** 编程题存储：在 AiApp 层提供，学习/练习/模拟考/错题本四个子模块共享 */
export function ProgProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ProgStore>(() => loadProgStore());
  useEffect(() => { saveProgStore(store); }, [store]);
  return <ProgStoreContext.Provider value={{ store, setStore }}>{children}</ProgStoreContext.Provider>;
}

export function useProgStore() {
  const ctx = useContext(ProgStoreContext);
  if (!ctx) throw new Error("useProgStore 必须在 ProgProvider 内使用");
  return ctx;
}
