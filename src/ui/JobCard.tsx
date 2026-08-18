import { useState } from "react";
import type { ListedVideo } from "../lib/files";
import { formatBytes, formatMediaDuration } from "../lib/files";
import type { Msg, UiLang } from "../lib/i18n";
import {
  friendlyError,
  hashHue,
  jobPhaseLabel,
  jobStages,
  langCodeLabel,
  langShort,
} from "../lib/pipeline";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { IconMore, IconStop } from "./icons";
import { Popover } from "./Popover";
import { Progress } from "./Progress";
import { StatusPill } from "./StatusPill";
import { Waveform } from "./Waveform";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  video: ListedVideo;
  selected: boolean;
  locked: boolean;
  working: boolean;
  uiLang: UiLang;
  tr: Tr;
  onSelect: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onCopy: (path: string, label: string) => void;
};

export function JobCard({
  video,
  selected,
  locked,
  working,
  uiLang,
  tr,
  onSelect,
  onRemove,
  onRetry,
  onCancel,
  onCopy,
}: Props) {
  const [menu, setMenu] = useState(false);
  const stages = jobStages(video, uiLang);
  const hue = hashHue(video.name);
  const percent = Math.round(video.percent ?? (video.status === "translated" ? 100 : 0));
  const error = video.status === "error" && video.error ? friendlyError(video.error, uiLang) : null;
  const live = video.status === "transcribing";
  const translating = video.status === "translating";
  const done = video.status === "translated";
  const frames = video.frames ?? [];

  return (
    <article
      className={`job-card ${selected ? "is-selected" : ""} ${video.status === "error" ? "is-failed" : ""} ${done ? "is-done" : ""}`}
      onClick={onSelect}
    >
      <div className="thumb" aria-hidden="true">
        {frames.length > 0 ? (
          <div className={`thumb-frames is-${Math.min(frames.length, 3)}`}>
            {frames.slice(0, 3).map((frame, index) => (
              <img key={index} src={frame} alt="" />
            ))}
          </div>
        ) : (
          <span
            style={{
              background: `linear-gradient(145deg, hsl(${hue} 28% 22%), hsl(${(hue + 40) % 360} 36% 10%))`,
            }}
          />
        )}
        {video.durationSecs != null ? (
          <b>{formatMediaDuration(video.durationSecs)}</b>
        ) : null}
      </div>

      <div className="job-main">
        <h3>{video.name}</h3>
        <div className="job-meta">
          <span>{formatBytes(video.sizeBytes)}</span>
          {video.spokenCode ? <span>{langShort(video.spokenCode, uiLang)}</span> : null}
          <StatusPill status={video.status} label={jobPhaseLabel(video, uiLang)} />
        </div>

        {video.status !== "queued" && video.status !== "error" ? (
          <div className="job-progress">
            <Progress value={percent} mint={translating} />
            <strong>{percent}%</strong>
          </div>
        ) : null}

        <div className="pipeline">
          {stages.map((stage, index) => (
            <span key={stage.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {index > 0 ? <span className="muted">→</span> : null}
              <span className={`pipe-step is-${stage.status}`}>
                {stage.label}
                {stage.status === "running" && stage.percent != null
                  ? ` ${Math.round(stage.percent)}%`
                  : ""}
                {stage.status === "completed" ? " ✓" : ""}
              </span>
            </span>
          ))}
        </div>

        {live ? (
          <div className="live-row">
            <Waveform />
            <p className="live-text">{video.message || tr("listening")}</p>
          </div>
        ) : null}

        {translating ? (
          <div className="translate-live">
            <article>
              <b>{langCodeLabel(video.spokenCode || "fr")}</b>
              <p>{tr("translateSourceHint")}</p>
            </article>
            <span aria-hidden="true">↓</span>
            <article>
              <b>{langCodeLabel(video.outputCode || "it")}</b>
              <p>{video.message || tr("translatingHint")}</p>
            </article>
          </div>
        ) : null}

        {done ? (
          <div className="done-cta">
            {video.folderPath ? (
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onCopy(video.folderPath!, tr("copyFolder"));
                }}
              >
                {tr("openFolder")}
              </Button>
            ) : null}
            {video.srtPath ? (
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onCopy(video.srtPath!, tr("copySrt"));
                }}
              >
                {tr("importDavinci")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="error-box">
            <h4>{error.title}</h4>
            <p>{error.hint}</p>
            <div className="done-cta">
              <Button
                variant="primary"
                disabled={locked}
                onClick={(event) => {
                  event.stopPropagation();
                  onRetry();
                }}
              >
                {tr("retry")}
              </Button>
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onCopy(video.error || "", tr("details"));
                }}
              >
                {tr("details")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="job-actions">
        {working && (video.status === "extracting" || video.status === "transcribing" || video.status === "translating" || video.status === "exporting") ? (
          <IconButton
            label={tr("stopStep")}
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
          >
            <IconStop />
          </IconButton>
        ) : null}
        <IconButton
          label={tr("actions")}
          onClick={(event) => {
            event.stopPropagation();
            setMenu((open) => !open);
          }}
        >
          <IconMore />
        </IconButton>
        <Popover open={menu} onClose={() => setMenu(false)}>
          <button
            type="button"
            onClick={() => {
              onCopy(video.path, tr("copyPath"));
              setMenu(false);
            }}
          >
            {tr("copyPath")}
          </button>
          {video.srtPath ? (
            <button
              type="button"
              onClick={() => {
                onCopy(video.srtPath!, tr("copySrt"));
                setMenu(false);
              }}
            >
              {tr("copySrt")}
            </button>
          ) : null}
          <button
            type="button"
            className="is-danger"
            disabled={locked}
            onClick={() => {
              setMenu(false);
              onRemove();
            }}
          >
            {tr("remove")}
          </button>
        </Popover>
      </div>
    </article>
  );
}
