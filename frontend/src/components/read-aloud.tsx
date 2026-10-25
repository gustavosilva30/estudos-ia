"use client";

import { Select } from "@/components/ui/forms";
import { PauseIcon, SpeakerIcon, StopIcon } from "@/components/ui/icons";
import { Alert, Button } from "@/components/ui/primitives";
import { markdownToSpeech, plainToSpeech } from "@/lib/speech";
import { RATES, useSpeech } from "@/lib/use-speech";

interface Props {
  text: string;
  /** "markdown": resumos e resultados de IA (a marcação é removida). "plain": texto original do usuário. */
  format: "markdown" | "plain";
  /** Falado antes do texto (ex.: título do resumo). */
  title?: string;
}

/** Leitura em voz alta usando o sintetizador do próprio navegador (sem custo, sem enviar nada ao nosso servidor). */
export function ReadAloud({ text, format, title }: Props) {
  const speech = useSpeech();

  if (!speech.supported) {
    return <p className="text-xs text-muted">Este navegador não oferece leitura em voz alta.</p>;
  }

  function start() {
    const body = format === "markdown" ? markdownToSpeech(text) : plainToSpeech(text);
    const heading = title?.trim();
    speech.play(heading ? `${heading.replace(/[.!?…]+$/, "")}.\n${body}` : body);
  }

  const active = speech.status !== "idle";

  return (
    <div role="group" aria-label="Leitura em voz alta" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {speech.status === "idle" && (
          <Button variant="secondary" onClick={start} disabled={!text.trim()}>
            <SpeakerIcon /> Ouvir
          </Button>
        )}
        {speech.status === "speaking" && (
          <Button variant="secondary" onClick={speech.pause}>
            <PauseIcon /> Pausar
          </Button>
        )}
        {speech.status === "paused" && (
          <Button variant="secondary" onClick={speech.resume}>
            <SpeakerIcon /> Continuar
          </Button>
        )}
        {active && (
          <Button variant="ghost" onClick={speech.stop}>
            <StopIcon /> Parar
          </Button>
        )}
        <span role="status" aria-live="polite" className="text-xs text-muted">
          {speech.status === "speaking" && `Lendo… trecho ${speech.current} de ${speech.total}`}
          {speech.status === "paused" && `Pausado no trecho ${speech.current} de ${speech.total}`}
        </span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-primary">Opções de voz</summary>
        <div className="mt-2 grid max-w-md gap-3 sm:grid-cols-2">
          <Select
            label="Velocidade"
            value={String(speech.prefs.rate)}
            onChange={(event) => speech.setRate(Number(event.target.value))}
          >
            {RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate === 1 ? "Normal (1×)" : `${String(rate).replace(".", ",")}×`}
              </option>
            ))}
          </Select>
          <Select
            label="Voz"
            value={speech.prefs.voiceURI}
            onChange={(event) => speech.setVoice(event.target.value)}
          >
            <option value="">Padrão do navegador (português)</option>
            {speech.voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </Select>
        </div>
        {speech.voices.length === 0 && (
          <p className="mt-2 text-xs text-muted">
            Nenhuma voz em português foi encontrada neste aparelho. A leitura pode sair com sotaque estranho; instale uma
            voz em português nas configurações do sistema.
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          A qualidade da voz depende do seu aparelho e navegador. Algumas vozes do Chrome são processadas online.
        </p>
      </details>

      {speech.error && <Alert>{speech.error}</Alert>}
    </div>
  );
}
