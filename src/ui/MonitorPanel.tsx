import { useEffect, useMemo, useState, type RefObject } from "react";
import { isActiveStatus } from "../lib/pipeline";
import type { useStudio } from "../lib/useStudio";
import { AudioCover, type AudioCoverHandle } from "./AudioCover";
import { Badge } from "./Badge";
import { DropZone } from "./DropZone";
import { IconButton } from "./IconButton";
import { IconFolder, IconResolve } from "./icons";
import { Popover, useMenuPoint } from "./Popover";
import { VideoPlayer, type VideoPlayerHandle } from "./VideoPlayer";

type Studio = ReturnType<typeof useStudio>;

type Props = {
  studio: Studio;
  pair: string;
  clock: number;
  onClock: (time: number) => void;
  videoApi: RefObject<VideoPlayerHandle | null>;
  audioApi: RefObject<AudioCoverHandle | null>;
  onSeek: (time: number) => void;
};

export function MonitorPanel({ studio, pair, clock, onClock, videoApi, audioApi, onSeek }: Props) {
  const { tr } = studio;
  const [duration, setDuration] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const menu = useMenuPoint();
  const selected = studio.selected;
  const empty = studio.videos.length === 0;
  const busy = Boolean(selected && isActiveStatus(selected.status));

  const playerActions = useMemo(() => {
    if (!selected) {
      return [];
    }
    const items = [
      {
        label: tr("copyPath"),
        onClick: () => void studio.copyText(selected.path, tr("copyPath")),
      },
    ];
    if (selected.folderPath) {
      items.push({
        label: tr("openFolder"),
        onClick: () => void studio.openFolder(selected.folderPath),
      });
    }
    if (selected.outputSrtPath || selected.srtPath) {
      items.push({
        label: tr("importDavinci"),
        onClick: () => void studio.importToDavinci(selected),
      });
    }
    return items;
  }, [selected, studio, tr]);

  useEffect(() => {
    setVideoFailed(false);
    setDuration(selected?.durationSecs ?? 0);
  }, [selected?.durationSecs, selected?.path]);

  return (
    <div className="studio-deck">
      <section className="studio-monitor" onContextMenu={menu.onContextMenu}>
        <header className="studio-pane-head">
          <h2>{selected?.name ?? tr("monitorTitle")}</h2>
          {selected ? (
            <div className="studio-pane-actions">
              {selected.folderPath ? (
                <IconButton label={tr("openFolder")} onClick={() => void studio.openFolder(selected.folderPath!)}>
                  <IconFolder />
                </IconButton>
              ) : null}
              {selected.outputSrtPath || selected.srtPath ? (
                <IconButton label={tr("importDavinci")} onClick={() => void studio.importToDavinci(selected)}>
                  <IconResolve />
                </IconButton>
              ) : null}
            </div>
          ) : null}
        </header>

        {empty ? (
          <DropZone
            dragging={studio.dragging}
            disabled={studio.locked}
            title={tr("dropTitle")}
            choose={tr("dropChoose")}
            onPick={() => void studio.onPickFiles()}
          >
            <div className="drop-meta">
              <Badge tone="accent">{pair}</Badge>
              <Badge>{tr("localPrivate")}</Badge>
            </div>
          </DropZone>
        ) : (
          <div className="monitor-stage">
            <VideoPlayer
              ref={videoApi}
              videoPath={selected?.path}
              poster={selected?.frames?.[0]}
              tr={tr}
              extraActions={playerActions}
              fallbackReady={Boolean(selected?.audioPath)}
              onTime={onClock}
              onDuration={setDuration}
              onUnavailable={setVideoFailed}
              onPlay={() => audioApi.current?.pause()}
              onFallbackToggle={() => audioApi.current?.play()}
              onSeek={onSeek}
            />
          </div>
        )}
      </section>

      {!empty ? (
        <AudioCover
          ref={audioApi}
          title={selected?.name}
          audioPath={selected?.audioPath}
          poster={selected?.frames?.[0]}
          duration={duration || selected?.durationSecs || 0}
          time={clock}
          segments={studio.script?.segments ?? []}
          busy={busy}
          hint={selected?.message || (videoFailed ? tr("videoUnavailable") : undefined)}
          tr={tr}
          onTime={onClock}
          onPlay={() => videoApi.current?.pause()}
          onSeek={onSeek}
        />
      ) : null}

      <Popover open={menu.point != null} x={menu.point?.x} y={menu.point?.y} onClose={menu.close}>
        {empty ? (
          <button
            type="button"
            disabled={studio.locked}
            onClick={() => {
              menu.close();
              void studio.onPickFiles();
            }}
          >
            {tr("cmdAdd")}
          </button>
        ) : (
          playerActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                action.onClick();
                menu.close();
              }}
            >
              {action.label}
            </button>
          ))
        )}
      </Popover>
    </div>
  );
}
