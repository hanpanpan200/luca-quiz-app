import type { AiStore, ChipStore } from "./types";

const AI_KEY = "swcode_quiz_v1";
const CHIP_KEY = "swcode_chip_v1";

export function freshAiStore(): AiStore {
  return { answers: {}, wrongBook: [], graduated: [], examHistory: [], v: 1 };
}

export function freshChipStore(): ChipStore {
  return { v: 1, attempts: {}, wrongBook: [], mic_enabled: false, exam_history: [] };
}

/** 解析并校验持久化数据，形状不对则回退到空 store */
function load<T>(key: string, fresh: () => T, valid: (s: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object" || !valid(s)) return fresh();
    return { ...fresh(), ...s };
  } catch {
    return fresh();
  }
}

export function loadAiStore(): AiStore {
  return load(AI_KEY, freshAiStore, (s) =>
    typeof (s as AiStore).answers === "object" && Array.isArray((s as AiStore).wrongBook));
}

export function loadChipStore(): ChipStore {
  return load(CHIP_KEY, freshChipStore, (s) =>
    typeof (s as ChipStore).attempts === "object" && Array.isArray((s as ChipStore).wrongBook));
}

export function saveAiStore(store: AiStore): void {
  localStorage.setItem(AI_KEY, JSON.stringify(store));
}

export function saveChipStore(store: ChipStore): void {
  localStorage.setItem(CHIP_KEY, JSON.stringify(store));
}
