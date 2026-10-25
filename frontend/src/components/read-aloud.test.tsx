// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSpeechModuleForTests, START_DELAY_MS } from "@/lib/use-speech";
import { ReadAloud } from "./read-aloud";

class FakeUtterance {
  lang = "";
  rate = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

function fakeVoice(name: string, lang: string) {
  return { name, lang, voiceURI: name, default: false, localService: true } as SpeechSynthesisVoice;
}

function installSynth(voices: SpeechSynthesisVoice[] = []) {
  const synth = {
    spoken: [] as FakeUtterance[],
    cancelled: 0,
    paused: 0,
    resumed: 0,
    speak(utterance: FakeUtterance) {
      this.spoken.push(utterance);
    },
    cancel() {
      this.cancelled += 1;
    },
    pause() {
      this.paused += 1;
    },
    resume() {
      this.resumed += 1;
    },
    getVoices: () => voices,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return synth;
}

const advance = () => act(() => void vi.advanceTimersByTime(START_DELAY_MS + 1));
const click = (name: RegExp) => act(() => void fireEvent.click(screen.getByRole("button", { name })));
const hasButton = (name: RegExp) => screen.queryByRole("button", { name }) !== null;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetSpeechModuleForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ReadAloud", () => {
  it("avisa quando o navegador não tem leitura em voz alta", () => {
    render(<ReadAloud text="Olá" format="plain" />);
    expect(screen.getByText(/não oferece leitura em voz alta/i)).toBeTruthy();
    expect(hasButton(/ouvir/i)).toBe(false);
  });

  it("lê trecho a trecho, sem a marcação do Markdown, e mostra o progresso", async () => {
    const synth = installSynth();
    render(<ReadAloud text={"# Título\n\nTexto **forte**."} format="markdown" />);
    await click(/ouvir/i);
    await advance();

    expect(synth.spoken.map((u) => u.text)).toEqual(["Título."]);
    expect(synth.spoken[0].lang).toBe("pt-BR");
    await act(() => void synth.spoken[0].onstart?.());
    expect(screen.getByRole("status").textContent).toBe("Lendo… trecho 1 de 2");
    expect(hasButton(/pausar/i)).toBe(true);

    await act(() => void synth.spoken[0].onend?.());
    expect(synth.spoken[1].text).toBe("Texto forte.");
    await act(() => void synth.spoken[1].onstart?.());
    expect(screen.getByRole("status").textContent).toBe("Lendo… trecho 2 de 2");

    await act(() => void synth.spoken[1].onend?.());
    expect(hasButton(/ouvir/i)).toBe(true); // terminou: volta ao início
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("fala o título antes do texto", async () => {
    const synth = installSynth();
    render(<ReadAloud text="Conteúdo." title="Meu resumo" format="markdown" />);
    await click(/ouvir/i);
    await advance();
    expect(synth.spoken[0].text).toBe("Meu resumo.");
  });

  it("texto original (plain) preserva símbolos digitados pelo usuário", async () => {
    const synth = installSynth();
    render(<ReadAloud text="2 * 3 = 6" format="plain" />);
    await click(/ouvir/i);
    await advance();
    expect(synth.spoken[0].text).toBe("2 * 3 = 6");
  });

  it("pausa, continua e para (e uma fala antiga não reinicia depois de parar)", async () => {
    const synth = installSynth();
    render(<ReadAloud text={"Primeira.\nSegunda."} format="plain" />);
    await click(/ouvir/i);
    await advance();

    await click(/pausar/i);
    expect(synth.paused).toBe(1);
    expect(screen.getByRole("status").textContent).toContain("Pausado");
    expect(hasButton(/continuar/i)).toBe(true);

    await click(/continuar/i);
    expect(synth.resumed).toBeGreaterThanOrEqual(1);
    expect(hasButton(/pausar/i)).toBe(true);

    const resumedBefore = synth.resumed;
    const cancelledBefore = synth.cancelled;
    const old = synth.spoken[0];
    await click(/parar/i);
    expect(synth.cancelled).toBe(cancelledBefore + 1);
    expect(synth.resumed).toBe(resumedBefore + 1); // evita o Chrome preso em "pausado"
    expect(hasButton(/ouvir/i)).toBe(true);

    await act(() => void old.onend?.());
    await advance();
    expect(synth.spoken).toHaveLength(1); // nada novo foi falado
  });

  it("velocidade escolhida é guardada e aplicada", async () => {
    const synth = installSynth();
    render(<ReadAloud text="Olá." format="plain" />);
    await act(() => void fireEvent.change(screen.getByLabelText("Velocidade"), { target: { value: "1.5" } }));
    expect(JSON.parse(localStorage.getItem("leitura") ?? "{}").rate).toBe(1.5);
    await click(/ouvir/i);
    await advance();
    expect(synth.spoken[0].rate).toBe(1.5);
  });

  it("lista só vozes em português (pt-BR primeiro) e usa a escolhida", async () => {
    const ptBr = fakeVoice("Voz BR", "pt-BR");
    const ptPt = fakeVoice("Voz PT", "pt-PT");
    const synth = installSynth([fakeVoice("English", "en-US"), ptPt, ptBr]);
    render(<ReadAloud text="Olá." format="plain" />);

    const options = [...screen.getByLabelText("Voz").querySelectorAll("option")].map((o) => o.textContent);
    expect(options).toEqual(["Padrão do navegador (português)", "Voz BR (pt-BR)", "Voz PT (pt-PT)"]);

    await act(() => void fireEvent.change(screen.getByLabelText("Voz"), { target: { value: "Voz PT" } }));
    await click(/ouvir/i);
    await advance();
    expect(synth.spoken[0].voice).toBe(ptPt);
    expect(synth.spoken[0].lang).toBe("pt-PT");
  });

  it("avisa quando não há voz em português instalada", () => {
    installSynth([fakeVoice("English", "en-US")]);
    render(<ReadAloud text="Olá." format="plain" />);
    expect(screen.getByText(/Nenhuma voz em português/)).toBeTruthy();
  });

  it("só uma leitura por vez: iniciar outra devolve a anterior ao estado parado", async () => {
    const synth = installSynth();
    render(
      <>
        <ReadAloud text="Primeiro componente." format="plain" />
        <ReadAloud text="Segundo componente." format="plain" />
      </>,
    );
    const [first, second] = screen.getAllByRole("button", { name: /ouvir/i });
    await act(() => void fireEvent.click(first));
    await advance();
    expect(screen.getAllByRole("button", { name: /pausar/i })).toHaveLength(1);

    await act(() => void fireEvent.click(second));
    await advance();
    expect(screen.getAllByRole("button", { name: /pausar/i })).toHaveLength(1); // só o segundo
    expect(screen.getAllByRole("button", { name: /ouvir/i })).toHaveLength(1); // o primeiro voltou
    expect(synth.spoken.at(-1)?.text).toBe("Segundo componente.");
  });

  it("ao sair da tela (desmontar), a leitura é cancelada", async () => {
    const synth = installSynth();
    const { unmount } = render(<ReadAloud text="Olá mundo." format="plain" />);
    await click(/ouvir/i);
    await advance();
    const before = synth.cancelled;
    unmount();
    expect(synth.cancelled).toBe(before + 1);
  });

  it("ignora cancelamentos e mostra mensagem clara nos erros de verdade", async () => {
    const synth = installSynth();
    render(<ReadAloud text="Olá mundo." format="plain" />);
    await click(/ouvir/i);
    await advance();

    await act(() => void synth.spoken[0].onerror?.({ error: "canceled" }));
    expect(hasButton(/pausar/i)).toBe(true); // continua lendo
    expect(screen.queryByRole("alert")).toBeNull();

    await act(() => void synth.spoken[0].onerror?.({ error: "synthesis-failed" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Não foi possível ler em voz alta/);
    expect(hasButton(/ouvir/i)).toBe(true);

    await click(/ouvir/i);
    await advance();
    await act(() => void synth.spoken.at(-1)?.onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("alert").textContent).toMatch(/bloqueou a leitura/);
  });

  it("o botão fica desativado quando não há texto", () => {
    installSynth();
    render(<ReadAloud text="   " format="plain" />);
    expect((screen.getByRole("button", { name: /ouvir/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
