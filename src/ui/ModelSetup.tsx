import type { EngineStatus, PreparePart, QualityPreset } from "../lib/files";
import type { Msg } from "../lib/i18n";
import type { PrepareState } from "../lib/useStudio";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Progress } from "./Progress";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

const WHISPER_SIZE: Record<QualityPreset, string> = {
  fast: "~150 MB",
  balanced: "~500 MB",
  max: "~3 GB",
};

type Props = {
  variant: "card" | "banner" | "settings";
  engine: EngineStatus | null;
  prepare: PrepareState | null;
  quality: QualityPreset;
  locked?: boolean;
  tr: Tr;
  onDownload: (parts?: PreparePart) => void;
  onDefer?: () => void;
};

function statusLabel(
  ready: boolean,
  downloading: boolean,
  tr: Tr,
): { tone: "ok" | "accent" | "neutral"; text: string } {
  if (downloading) {
    return { tone: "accent", text: tr("setupStatusDownloading") };
  }
  if (ready) {
    return { tone: "ok", text: tr("setupStatusReady") };
  }
  return { tone: "neutral", text: tr("setupStatusMissing") };
}

export function ModelSetup({
  variant,
  engine,
  prepare,
  quality,
  locked,
  tr,
  onDownload,
  onDefer,
}: Props) {
  const active = Boolean(prepare?.active);
  const ready = Boolean(engine?.modelsReady) && !active;
  const pythonOk = Boolean(engine?.pythonOk && engine?.whisperOk);
  const canDownload = pythonOk && !locked && !active;

  if (variant === "banner" && ready) {
    return null;
  }
  if (variant === "card" && ready) {
    return null;
  }

  const whisperBusy = active && (prepare?.part === "whisper" || prepare?.part === "engine");
  const translateBusy = active && (prepare?.part === "translate" || prepare?.part === "engine");
  const whisper = statusLabel(Boolean(engine?.whisperReady), Boolean(whisperBusy && !engine?.whisperReady), tr);
  const translate = statusLabel(
    Boolean(engine?.translateReady),
    Boolean(translateBusy && !engine?.translateReady),
    tr,
  );

  return (
    <section className={`setup-panel is-${variant}`}>
      <div className="setup-head">
        <div>
          <p className="kicker">{tr(variant === "settings" ? "engineTitle" : "setupKicker")}</p>
          <h2>{active ? tr("setupBannerTitle") : ready ? tr("setupReady") : tr("setupTitle")}</h2>
          <p className="muted">
            {!engine
              ? tr("setupChecking")
              : !engine.pythonOk || !engine.whisperOk
                ? tr("setupNeedPython")
                : ready
                  ? tr("setupReadyHint")
                  : tr("setupLead")}
          </p>
          {engine && !engine.ffmpegOk ? <p className="muted">{tr("setupNeedFfmpeg")}</p> : null}
        </div>
        {variant === "banner" ? (
          <Button variant="primary" disabled={!canDownload} onClick={() => onDownload("all")}>
            {active ? `${Math.round(prepare?.percent ?? 0)}%` : tr("setupDownloadAll")}
          </Button>
        ) : !ready || active ? (
          <div className="setup-actions">
            <Button variant="primary" disabled={!canDownload} onClick={() => onDownload("all")}>
              {active ? tr("setupDownloading") : tr("setupDownloadAll")}
            </Button>
            {variant === "card" && onDefer && !active ? (
              <Button variant="ghost" onClick={onDefer}>
                {tr("setupLater")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {active ? (
        <div className="setup-progress">
          <Progress value={prepare?.percent ?? 0} />
          <p>
            <strong>{Math.round(prepare?.percent ?? 0)}%</strong>
            <span>{prepare?.message || tr("setupDownloading")}</span>
          </p>
        </div>
      ) : null}

      <div className="setup-models">
        <article>
          <div>
            <b>{tr("setupWhisper")}</b>
            <p>{tr("setupWhisperHint", { size: WHISPER_SIZE[quality] })}</p>
          </div>
          <div className="setup-model-meta">
            <Badge tone={whisper.tone}>{whisper.text}</Badge>
            {variant === "settings" ? (
              <Button
                variant="ghost"
                disabled={!canDownload || Boolean(engine?.whisperReady)}
                onClick={() => onDownload("whisper")}
              >
                {tr("setupDownloadWhisper")}
              </Button>
            ) : null}
          </div>
        </article>
        <article>
          <div>
            <b>{tr("setupTranslate")}</b>
            <p>{tr("setupTranslateHint")}</p>
          </div>
          <div className="setup-model-meta">
            <Badge tone={translate.tone}>{translate.text}</Badge>
            {variant === "settings" ? (
              <Button
                variant="ghost"
                disabled={!canDownload || Boolean(engine?.translateReady)}
                onClick={() => onDownload("translate")}
              >
                {tr("setupDownloadTranslate")}
              </Button>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
