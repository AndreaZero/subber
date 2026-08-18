import { useState } from "react";
import type { ListedVideo } from "../lib/files";
import { formatBytes, formatMediaDuration } from "../lib/files";
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

type Props = {
  video: ListedVideo;
  selected: boolean;
  locked: boolean;
  working: boolean;
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
  onSelect,
  onRemove,
  onRetry,
  onCancel,
  onCopy,
}: Props) {
  const [menu, setMenu] = useState(false);
  const stages = jobStages(video);
  const hue = hashHue(video.name);
  const percent = Math.round(video.percent ?? (video.status === "translated" ? 100 : 0));
  const error = video.status === "error" && video.error ? friendlyError(video.error) : null;
  const live = video.status === "transcribing";
  const translating = video.status === "translating";
  const done = video.status === "translated";

  return (
    <article
      className={`job-card ${selected ? "is-selected" : ""} ${video.status === "error" ? "is-failed" : ""} ${done ? "is-done" : ""}`}
      onClick={onSelect}
    >
      <div className="thumb" aria-hidden="true">
        <span
          style={{
            background: `linear-gradient(145deg, hsl(${hue} 28% 22%), hsl(${(hue + 40) % 360} 36% 10%))`,
          }}
        />
        {video.durationSecs != null ? (
          <b>{formatMediaDuration(video.durationSecs)}</b>
        ) : null}
      </div>

      <div className="job-main">
        <h3>{video.name}</h3>
        <div className="job-meta">
          <span>{formatBytes(video.sizeBytes)}</span>
          {video.spokenCode ? <span>{langShort(video.spokenCode)}</span> : null}
          <StatusPill status={video.status} label={jobPhaseLabel(video)} />
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
            <p className="live-text">{video.message || "Listening for speech…"}</p>
          </div>
        ) : null}

        {translating ? (
          <div className="translate-live">
            <article>
              <b>{langCodeLabel(video.spokenCode || "fr")}</b>
              <p>Source lines stay intact while the editorial pass runs.</p>
            </article>
            <span aria-hidden="true">↓</span>
            <article>
              <b>{langCodeLabel(video.outputCode || "it")}</b>
              <p>{video.message || "Translating with neighbouring context…"}</p>
            </article>
          </div>
        ) : null}

        {done ? (
          <div className="done-cta">
            {video.srtPath ? (
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onCopy(video.srtPath!, "Source SRT path copied");
                }}
              >
                Preview subtitles
              </Button>
            ) : null}
            {video.srtPath ? (
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onCopy(video.srtPath!, "SRT path copied — import this file in DaVinci");
                }}
              >
                Import in DaVinci
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
                Retry
              </Button>
              <Button
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onCopy(video.error || "", "Details copied");
                }}
              >
                Details
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="job-actions">
        {working && (video.status === "extracting" || video.status === "transcribing" || video.status === "translating" || video.status === "exporting") ? (
          <IconButton
            label="Stop after this step"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
          >
            <IconStop />
          </IconButton>
        ) : null}
        <IconButton
          label="Actions"
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
              onCopy(video.path, "File path copied");
              setMenu(false);
            }}
          >
            Copy path
          </button>
          {video.srtPath ? (
            <button
              type="button"
              onClick={() => {
                onCopy(video.srtPath!, "SRT path copied");
                setMenu(false);
              }}
            >
              Copy SRT path
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
            Remove
          </button>
        </Popover>
      </div>
    </article>
  );
}
