"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { splitIntoChunks } from "./speech";

/* ---------- preferências (velocidade e voz), guardadas neste navegador ---------- */

export interface SpeechPrefs {
  rate: number;
  voiceURI: string; // "" = padrão do navegador para pt-BR
}

export const RATES = [0.75, 1, 1.25, 1.5, 1.75];
const STORAGE_KEY = "leitura";
const DEFAULT_PREFS: SpeechPrefs = { rate: 1, voiceURI: "" };

let prefs: SpeechPrefs = DEFAULT_PREFS;
let prefsLoaded = false;
const prefListeners = new Set<() => void>();

function loadPrefs() {
  if (prefsLoaded) return;
  prefsLoaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SpeechPrefs> | null;
    if (raw && typeof raw === "object") {
      prefs = {
        rate: typeof raw.rate === "number" && RATES.includes(raw.rate) ? raw.rate : DEFAULT_PREFS.rate,
        voiceURI: typeof raw.voiceURI === "string" ? raw.voiceURI : "",
      };
    }
  } catch {
    /* armazenamento indisponível ou corrompido: usa o padrão */
  }
}

function getPrefs(): SpeechPrefs {
  loadPrefs();
  return prefs;
}

function setPrefs(patch: Partial<SpeechPrefs>) {
  prefs = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* vale só nesta visita */
  }
  prefListeners.forEach((listener) => listener());
}

function subscribePrefs(listener: () => void) {
  prefListeners.add(listener);
  return () => prefListeners.delete(listener);
}

/* ---------- vozes em português disponíveis no aparelho ---------- */

let voicesCache: SpeechSynthesisVoice[] = [];
const NO_VOICES: SpeechSynthesisVoice[] = [];

function getVoices(): SpeechSynthesisVoice[] {
  const list = window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("pt"))
    .sort((a, b) => Number(b.lang.toLowerCase() === "pt-br") - Number(a.lang.toLowerCase() === "pt-br"));
  const same = list.length === voicesCache.length && list.every((voice, i) => voice.voiceURI === voicesCache[i].voiceURI);
  if (!same) voicesCache = list; // referência estável enquanto nada muda (exigência do useSyncExternalStore)
  return voicesCache;
}

function subscribeVoices(listener: () => void) {
  if (!("speechSynthesis" in window)) return () => undefined;
  window.speechSynthesis.addEventListener("voiceschanged", listener);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", listener);
}

/* ---------- reprodução ---------- */

export type SpeechStatus = "idle" | "speaking" | "paused";

interface SpeechState {
  status: SpeechStatus;
  current: number;
  total: number;
  error: string | null;
}

const IDLE: SpeechState = { status: "idle", current: 0, total: 0, error: null };
export const START_DELAY_MS = 50; // o Chrome às vezes ignora speak() logo após cancel()

/** Só uma leitura por vez: quem começa avisa a anterior para voltar ao estado parado. */
let resetActive: (() => void) | null = null;

/** Apenas para testes. */
export function resetSpeechModuleForTests() {
  prefs = DEFAULT_PREFS;
  prefsLoaded = false;
  voicesCache = [];
  resetActive = null;
}

export function useSpeech() {
  const supported = useSyncExternalStore(
    () => () => undefined,
    () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    () => false,
  );
  const currentPrefs = useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
  const voices = useSyncExternalStore(subscribeVoices, () => (supported ? getVoices() : NO_VOICES), () => NO_VOICES);

  const [state, setState] = useState<SpeechState>(IDLE);
  const token = useRef(0);
  const latest = useRef({ prefs: currentPrefs, voices });
  useEffect(() => {
    latest.current = { prefs: currentPrefs, voices };
  });

  const reset = useCallback(() => {
    token.current += 1;
    setState(IDLE);
  }, []);

  const stop = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    reset();
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume(); // Chrome: após pause(), o cancel() deixa o sintetizador preso em "pausado"
    if (resetActive === reset) resetActive = null;
  }, [reset]);

  const play = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;
      const chunks = splitIntoChunks(text);
      if (chunks.length === 0) {
        setState({ ...IDLE, error: "Não há texto para ler." });
        return;
      }
      resetActive?.(); // a leitura de outro componente (se houver) volta a "parado"
      resetActive = reset;
      const mine = ++token.current;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      setState({ status: "speaking", current: 1, total: chunks.length, error: null });

      const speak = (index: number) => {
        if (token.current !== mine) return;
        if (index >= chunks.length) {
          setState(IDLE);
          if (resetActive === reset) resetActive = null;
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        const { prefs: p, voices: v } = latest.current;
        const voice = v.find((candidate) => candidate.voiceURI === p.voiceURI);
        utterance.lang = voice?.lang ?? "pt-BR";
        if (voice) utterance.voice = voice;
        utterance.rate = p.rate;
        utterance.onstart = () =>
          setState((s) => (token.current === mine ? { ...s, current: index + 1, error: null } : s));
        utterance.onend = () => speak(index + 1);
        utterance.onerror = (event) => {
          if (token.current !== mine) return;
          // "canceled"/"interrupted" acontecem quando o próprio usuário para ou troca a leitura.
          if (event.error === "canceled" || event.error === "interrupted") return;
          token.current += 1;
          window.speechSynthesis.cancel();
          setState({
            ...IDLE,
            error:
              event.error === "not-allowed"
                ? "O navegador bloqueou a leitura. Clique em Ouvir novamente."
                : "Não foi possível ler em voz alta. Verifique se há uma voz em português instalada neste aparelho.",
          });
        };
        window.speechSynthesis.speak(utterance);
      };

      setTimeout(() => speak(0), START_DELAY_MS);
    },
    [reset],
  );

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setState((s) => (s.status === "speaking" ? { ...s, status: "paused" } : s));
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setState((s) => (s.status === "paused" ? { ...s, status: "speaking" } : s));
  }, []);

  // Ao sair da tela (ou esconder a rota), a leitura para.
  useEffect(
    () => () => {
      if (resetActive === reset && "speechSynthesis" in window) {
        token.current += 1;
        window.speechSynthesis.cancel();
        resetActive = null;
      }
    },
    [reset],
  );

  return {
    supported,
    voices,
    prefs: currentPrefs,
    setRate: (rate: number) => setPrefs({ rate }),
    setVoice: (voiceURI: string) => setPrefs({ voiceURI }),
    ...state,
    play,
    pause,
    resume,
    stop,
  };
}
