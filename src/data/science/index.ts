import g3aU2 from "./g3a-u2.json";
import type { ScienceUnit } from "../../types";

/** 校内科学单元列表：新单元来了加一个 JSON import 即可，界面/存储自动扩展。
 *  命名 g{年级}{a=上|b=下}-u{单元号}，如 g3a-u2 = 三年级上册第二单元。 */
export const SCIENCE_UNITS: ScienceUnit[] = [g3aU2 as unknown as ScienceUnit];

export function findScienceUnit(id: string | undefined): ScienceUnit | undefined {
  return SCIENCE_UNITS.find((u) => u.id === id);
}
