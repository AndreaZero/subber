import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { EngineStatus, PreparePart, PrepareProgress, QualityPreset } from "../lib/files";
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
  needsTranslation?: boolean;
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
  needsTranslation = true,
}: Props) {
  const [live, setLive] = useState(prepare);
  useEffect(() => {
    setLive(prepare);
  }, [prepare]);
  useEffect(() => {
    if (!prepare?.active) {
      return;
    }
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen<PrepareProgress>("prepare-progress", (event) => {
      const payload = event.payload;
      setLive({
        active: payload.status !== "done" && payload.status !== "error",
        part: payload.part,
        message: payload.message,
        percent: payload.percent ?? 0,
      });
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [prepare?.active]);

  const active = Boolean(live?.active || prepare?.active);
  const ready =
    Boolean(engine?.whisperReady && (!needsTranslation || engine.translateReady)) && !active;
  const pythonOk = Boolean(engine?.pythonOk && engine?.whisperOk);
  const canDownload = pythonOk && !locked && !active;

  if (variant === "banner" && ready) {
    return null;
  }
  if (variant === "card" && ready) {
    return null;
  }

  const whisperBusy = active && (live?.part === "whisper" || live?.part === "engine" || live?.part === "runtime" || live?.part === "packages");
  const translateBusy = active && (live?.part === "translate" || live?.part === "engine");
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
          <Button variant="primary" disabled={!canDownload} onClick={() => onDownload(needsTranslation ? "all" : "whisper")}>
            {active ? `${Math.round(live?.percent ?? 0)}%` : tr("setupDownloadAll")}
          </Button>
        ) : !ready || active ? (
          <div className="setup-actions">
            <Button variant="primary" disabled={!canDownload} onClick={() => onDownload(needsTranslation ? "all" : "whisper")}>
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
          <Progress value={live?.percent ?? 0} busy />
          <p>
            <strong>{Math.round(live?.percent ?? 0)}%</strong>
            <span>{live?.message || tr("setupDownloading")}</span>
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
        {needsTranslation ? (
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
        ) : null}
      </div>
    </section>
  );
}
