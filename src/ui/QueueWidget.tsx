import type { ListedVideo } from "../lib/files";
import type { Msg, UiLang } from "../lib/i18n";
import { mediaSrc } from "../lib/media";
import { hashHue, isActiveStatus, jobPhaseLabel } from "../lib/pipeline";
import { IconButton } from "./IconButton";
import { IconMore, IconPlus, IconStop } from "./icons";
import { menuPointFromElement, Popover, useMenuPoint } from "./Popover";
import { Progress } from "./Progress";
import { Tooltip } from "./Tooltip";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Tone = "ready" | "run" | "error" | "wait";

type Props = {
  videos: ListedVideo[];
  selectedPath: string | null;
  locked: boolean;
  working: boolean;
  adding?: boolean;
  compact?: boolean;
  uiLang: UiLang;
  tr: Tr;
  onAdd: () => void;
  onSelect: (path: string) => void;
  onRemove: (path: string) => void;
  onRetry: (video: ListedVideo) => void;
  onCancel: () => void;
  onCopy: (path: string, label: string) => void;
  onOpenFolder: (path: string) => void;
  onImportDavinci: (video: ListedVideo) => void;
};

function toneOf(video: ListedVideo, working: boolean): Tone {
  if (video.status === "error") {
    return "error";
  }
  if (isActiveStatus(video.status)) {
    return "run";
  }
  if (working && video.status === "queued") {
    return "wait";
  }
  return "ready";
}

function captionOf(video: ListedVideo, working: boolean, uiLang: UiLang, tr: Tr): string {
  const tone = toneOf(video, working);
  if (tone === "wait") {
    return tr("queueWaiting");
  }
  const label = jobPhaseLabel(video, uiLang);
  if (tone === "run") {
    const percent = Math.round(video.percent ?? 0);
    return percent > 0 ? `${label} ${percent}%` : label;
  }
  return label;
}

function QueueRow({
  video,
  selected,
  locked,
  working,
  compact,
  uiLang,
  tr,
  onSelect,
  onRemove,
  onRetry,
  onCancel,
  onCopy,
  onOpenFolder,
  onImportDavinci,
}: {
  video: ListedVideo;
  selected: boolean;
  locked: boolean;
  working: boolean;
  compact?: boolean;
  uiLang: UiLang;
  tr: Tr;
  onSelect: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onCopy: (path: string, label: string) => void;
  onOpenFolder: (path: string) => void;
  onImportDavinci: () => void;
}) {
  const menu = useMenuPoint();
  const tone = toneOf(video, working);
  const hue = hashHue(video.name);
  const frame = video.frames?.[0];
  const percent = Math.round(video.percent ?? 0);
  const running = isActiveStatus(video.status);
  const label = `${video.name} · ${captionOf(video, working, uiLang, tr)}`;

  const body = (
    <article
      className={`queue-item ${selected ? "is-on" : ""} is-${tone}`}
      onContextMenu={menu.onContextMenu}
    >
      <button type="button" className="queue-hit" onClick={onSelect}>
        <span
          className="queue-thumb"
          style={
            frame
              ? undefined
              : {
                  background: `linear-gradient(145deg, hsl(${hue} 28% 22%), hsl(${(hue + 40) % 360} 36% 10%))`,
                }
          }
        >
          {frame ? <img src={mediaSrc(frame)} alt="" /> : null}
        </span>
        <span className="queue-copy">
          <span className="queue-name">{video.name}</span>
          <span className="queue-state">
            <i className={`queue-dot is-${tone}`} />
            {captionOf(video, working, uiLang, tr)}
          </span>
          {running ? <Progress value={percent} busy={percent < 100} /> : null}
        </span>
      </button>
      <span className="queue-actions">
        {working && running ? (
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
      </span>
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
    </article>
  );

  if (!compact) {
    return body;
  }

  return <Tooltip label={label}>{body}</Tooltip>;
}

export function QueueWidget({
  videos,
  selectedPath,
  locked,
  working,
  adding,
  compact,
  uiLang,
  tr,
  onAdd,
  onSelect,
  onRemove,
  onRetry,
  onCancel,
  onCopy,
  onOpenFolder,
  onImportDavinci,
}: Props) {
  return (
    <section className={`sidebar-queue ${compact ? "is-compact" : ""}`}>
      <header className="queue-head">
        <p className="kicker">
          {tr("queueTitle")}
          <span className="queue-count">{videos.length}</span>
        </p>
        <IconButton label={tr("cmdAdd")} onClick={onAdd} disabled={locked}>
          <IconPlus />
        </IconButton>
      </header>
      {adding ? <div className="ui-skel queue-skel" /> : null}
      <div className="queue-list">
        {videos.map((video) => (
          <QueueRow
            key={video.path}
            video={video}
            selected={selectedPath === video.path}
            locked={locked}
            working={working}
            compact={compact}
            uiLang={uiLang}
            tr={tr}
            onSelect={() => onSelect(video.path)}
            onRemove={() => onRemove(video.path)}
            onRetry={() => onRetry(video)}
            onCancel={onCancel}
            onCopy={onCopy}
            onOpenFolder={onOpenFolder}
            onImportDavinci={() => onImportDavinci(video)}
          />
        ))}
      </div>
      {videos.length === 0 && !adding ? <p className="queue-empty">{tr("queueEmpty")}</p> : null}
    </section>
  );
}
