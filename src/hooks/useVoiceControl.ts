import { useEffect, useRef } from "react";
import { VOICE_START, VOICE_STOP, matchPhrase } from "../domain/chipRules";

type Mode = "start" | "stop";

interface Options {
  /** 麦克风开关（用户偏好，持久化） */
  enabled: boolean;
  /** 是否处于答题会话中（离开会话即停止监听） */
  active: boolean;
  /** idle 听开始词；timing 听结束词 */
  mode: Mode;
  onStart: () => void;
  onStop: () => void;
}

export function voiceSupported(): boolean {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return typeof window !== "undefined" && !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** 声控计时：Web Speech API 连续监听，按钮永远可用。浏览器静音自动停后重启。 */
export function useVoiceControl({ enabled, active, mode, onStart, onStop }: Options): void {
  const recRef = useRef<any>(null);
  const modeRef = useRef(mode);
  const handlers = useRef({ onStart, onStop });
  const lastFire = useRef(0);
  const fails = useRef(0);

  modeRef.current = mode;
  handlers.current = { onStart, onStop };

  useEffect(() => {
    if (!enabled || !active || !voiceSupported()) return;
    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      const phrases = modeRef.current === "stop" ? VOICE_STOP : VOICE_START;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (matchPhrase(e.results[i][0].transcript, phrases)) {
          if (Date.now() - lastFire.current > 1500) { // 一句话只触发一次
            lastFire.current = Date.now();
            modeRef.current === "stop" ? handlers.current.onStop() : handlers.current.onStart();
          }
          return;
        }
      }
    };
    rec.onend = () => {
      // 浏览器静音会自动停；会话仍在进行则短暂后续听
      setTimeout(() => {
        try { rec.start(); } catch { /* 端口占用等 */ }
      }, 300);
    };
    rec.onerror = () => {
      if (++fails.current >= 5) {
        try { rec.onend = null; rec.stop(); } catch { /* 已停止 */ }
      }
    };
    try { rec.start(); fails.current = 0; } catch { /* 已在运行 */ }

    return () => {
      try { rec.onend = null; rec.stop(); } catch { /* 已停止 */ }
      recRef.current = null;
    };
  }, [enabled, active]); // mode 变化不改监听，只改触发词集合（经 modeRef）
}
