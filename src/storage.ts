import type { AiStore, ChipStore, ProgStore } from "./types";

const AI_KEY = "swcode_quiz_v1";
const CHIP_KEY = "swcode_chip_v1";
const PROG_KEY = "swcode_prog_v1";

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

/** AI 模块·编程题：结构与 chipStore 相同（attempts + wrongBook） */
export function freshProgStore(): ProgStore {
  return { v: 1, attempts: {}, wrongBook: [] };
}

export function loadProgStore(): ProgStore {
  return load(PROG_KEY, freshProgStore, (s) =>
    typeof (s as ProgStore).attempts === "object" && Array.isArray((s as ProgStore).wrongBook));
}

export function saveProgStore(store: ProgStore): void {
  localStorage.setItem(PROG_KEY, JSON.stringify(store));
}

/** 校内科学：一个单元一个 key（swcode_science_<unitId>_v1），进度互不干扰、新单元零迁移。
 *  store 沿用 AiStore 形状，答题/错题/统计的领域逻辑（aiRecords）直接复用。 */
const SCIENCE_KEY_PREFIX = "swcode_science_";
const UNIT_ID_RE = /^g\d[ab]-u\d+$/;

export function scienceKey(unitId: string): string {
  if (!UNIT_ID_RE.test(unitId)) throw new Error(`非法的单元 id：${unitId}`);
  return `${SCIENCE_KEY_PREFIX}${unitId}_v1`;
}

export function loadScienceStore(unitId: string): AiStore {
  return load(scienceKey(unitId), freshAiStore, (s) =>
    typeof (s as AiStore).answers === "object" && Array.isArray((s as AiStore).wrongBook));
}

export function saveScienceStore(unitId: string, store: AiStore): void {
  localStorage.setItem(scienceKey(unitId), JSON.stringify(store));
}
