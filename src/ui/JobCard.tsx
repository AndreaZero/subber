import { memo } from "react";
import type { ListedVideo } from "../lib/files";
import { formatBytes, formatMediaDuration } from "../lib/files";
import type { Msg, UiLang } from "../lib/i18n";
import { mediaSrc } from "../lib/media";
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
import { menuPointFromElement, Popover, useMenuPoint } from "./Popover";
import { Progress } from "./Progress";
import { StatusPill } from "./StatusPill";
import { Waveform } from "./Waveform";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  video: ListedVideo;
  selected: boolean;
  locked: boolean;
  working: boolean;
  dense?: boolean;
  showTranslation: boolean;
  uiLang: UiLang;
  tr: Tr;
  onSelect: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onCopy: (path: string, label: string) => void;
  onOpenFolder: (path: string) => void;
  onImportDavinci: () => void;
};

function JobCardView({
  video,
  selected,
  locked,
  working,
  dense,
  showTranslation,
  uiLang,
  tr,
  onSelect,
  onRemove,
  onRetry,
  onCancel,
  onCopy,
  onOpenFolder,
  onImportDavinci,
}: Props) {
  const menu = useMenuPoint();
  const stages = jobStages(video, uiLang, showTranslation);
  const hue = hashHue(video.name);
  const percent = Math.round(video.percent ?? (video.status === "translated" ? 100 : 0));
  const error = video.status === "error" && video.error ? friendlyError(video.error, uiLang) : null;
  const live = video.status === "transcribing" || video.status === "extracting";
  const translating = showTranslation && video.status === "translating";
  const done = video.status === "translated";
  const frames = video.frames ?? [];
  const busy =
    video.status === "extracting" ||
    video.status === "transcribing" ||
    video.status === "translating" ||
    video.status === "exporting";

  return (
    <article
      className={`job-card ${dense ? "is-dense" : ""} ${selected ? "is-selected" : ""} ${video.status === "error" ? "is-failed" : ""} ${done ? "is-done" : ""}`}
      onClick={onSelect}
      onContextMenu={menu.onContextMenu}
    >
      <div className="thumb" aria-hidden="true">
        {frames.length > 0 ? (
          <div className={`thumb-frames is-${Math.min(frames.length, 3)}`}>
            {frames.slice(0, 3).map((frame, index) => (
              <img key={index} src={mediaSrc(frame)} alt="" />
            ))}
          </div>
        ) : (
          <span
            style={{
              background: `linear-gradient(145deg, hsl(${235 + (hue % 28)} 22% 28%), hsl(${248 + (hue % 16)} 30% 16%))`,
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
            <Progress value={percent} mint={translating} busy={busy && percent < 100} />
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
                  onOpenFolder(video.folderPath!);
                }}
              >
                {tr("openFolder")}
              </Button>
            ) : null}
            {video.outputSrtPath || video.srtPath ? (
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onImportDavinci();
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
            if (menu.point) {
              menu.close();
            } else {
              menu.openAt(menuPointFromElement(event.currentTarget));
            }
          }}
        >
          <IconMore />
        </IconButton>
        <Popover open={menu.point != null} x={menu.point?.x} y={menu.point?.y} onClose={menu.close}>
          <button
            type="button"
            onClick={() => {
              onCopy(video.path, tr("copyPath"));
              menu.close();
            }}
          >
            {tr("copyPath")}
          </button>
          {video.folderPath ? (
            <button
              type="button"
              onClick={() => {
                onOpenFolder(video.folderPath!);
                menu.close();
              }}
            >
              {tr("openFolder")}
            </button>
          ) : null}
          {video.srtPath ? (
            <button
              type="button"
              onClick={() => {
                onCopy(video.srtPath!, tr("copySrt"));
                menu.close();
              }}
            >
              {tr("copySrt")}
            </button>
          ) : null}
          {video.outputSrtPath || video.srtPath ? (
            <button
              type="button"
              onClick={() => {
                onImportDavinci();
                menu.close();
              }}
            >
              {tr("importDavinci")}
            </button>
          ) : null}
          {video.status === "error" ? (
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                onRetry();
                menu.close();
              }}
            >
              {tr("retry")}
            </button>
          ) : null}
          <button
            type="button"
            className="is-danger"
            disabled={locked}
            onClick={() => {
              menu.close();
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

export const JobCard = memo(JobCardView, (prev, next) => {
  return (
    prev.video === next.video &&
    prev.selected === next.selected &&
    prev.locked === next.locked &&
    prev.working === next.working &&
    prev.dense === next.dense &&
    prev.showTranslation === next.showTranslation &&
    prev.uiLang === next.uiLang
  );
});
