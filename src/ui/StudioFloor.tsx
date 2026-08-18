import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatClock,
  formatMediaDuration,
  languageName,
} from "../lib/files";
import { phaseLabel, wantsTranslation } from "../lib/pipeline";
import type { useStudio } from "../lib/useStudio";
import { AudioPlayer, type AudioPlayerHandle } from "./AudioPlayer";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { DropZone } from "./DropZone";
import { IconButton } from "./IconButton";
import { IconFolder, IconPlus, IconResolve } from "./icons";
import { JobCard } from "./JobCard";
import { Metric } from "./Metric";
import { Popover, useMenuPoint } from "./Popover";
import { Progress } from "./Progress";
import { ScriptPanel } from "./ScriptPanel";
import { VideoPlayer, type VideoPlayerHandle } from "./VideoPlayer";

type Studio = ReturnType<typeof useStudio>;

type Props = {
  studio: Studio;
  pair: string;
  preparing: boolean;
};

export function StudioFloor({ studio, pair, preparing }: Props) {
  const { tr, uiLang } = studio;
  const videoApi = useRef<VideoPlayerHandle>(null);
  const audioApi = useRef<AudioPlayerHandle>(null);
  const [clock, setClock] = useState(0);
  const queueMenu = useMenuPoint();
  const monitorMenu = useMenuPoint();
  const selected = studio.selected;
  const empty = studio.videos.length === 0;
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
    setClock(0);
  }, [selected?.path]);

  function onClock(time: number) {
    setClock((prev) => (Math.abs(prev - time) < 0.08 ? prev : time));
  }

  function seekAll(time: number) {
    videoApi.current?.seek(time);
    audioApi.current?.seek(time);
    setClock(time);
  }

  return (
    <div className={`studio-floor ${studio.working ? "is-busy" : ""}`}>
      {studio.working || studio.mode === "processing" || studio.mode === "completed" ? (
        <div className="studio-run">
          <Metric label={tr("metricInterviews")} value={`${studio.doneCount} / ${studio.videos.length}`} />
          {studio.failCount > 0 ? <Metric label={tr("metricFailed")} value={`${studio.failCount}`} /> : null}
          <div className="studio-run-main">
            <Progress value={studio.progress} mint={studio.phase === "translate"} busy={studio.working} />
            <div className="stats">
              <Metric label={tr("metricElapsed")} value={formatClock(studio.elapsedSecs)} />
              {studio.processedSecs > 0 ? (
                <Metric label={tr("metricProcessed")} value={formatMediaDuration(studio.processedSecs)} />
              ) : null}
              <Metric label={tr("metricPhase")} value={phaseLabel(studio.phase, uiLang)} />
            </div>
          </div>
          <Button variant="ghost" disabled={!studio.working} onClick={studio.requestCancel}>
            {tr("stop")}
          </Button>
          {studio.mode === "completed" && studio.outputDir ? (
            <IconButton label={tr("openFolder")} onClick={() => void studio.openFolder(studio.outputDir)}>
              <IconFolder />
            </IconButton>
          ) : null}
        </div>
      ) : null}

      <section className="studio-monitor" onContextMenu={monitorMenu.onContextMenu}>
        <header className="studio-pane-head">
          <div>
            <p className="kicker">{tr("monitorTitle")}</p>
            <h2>{selected?.name ?? tr("dropTitle")}</h2>
          </div>
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
          <>
            <VideoPlayer
              ref={videoApi}
              videoPath={selected?.path}
              poster={selected?.frames?.[0]}
              tr={tr}
              extraActions={playerActions}
              onTime={onClock}
              onPlay={() => audioApi.current?.pause()}
            />
            <AudioPlayer
              ref={audioApi}
              audioPath={selected?.audioPath}
              segments={studio.script?.segments ?? []}
              clock={clock}
              tr={tr}
              onTime={onClock}
              onPlay={() => videoApi.current?.pause()}
              onSeek={seekAll}
            />
          </>
        )}
        <Popover
          open={monitorMenu.point != null}
          x={monitorMenu.point?.x}
          y={monitorMenu.point?.y}
          onClose={monitorMenu.close}
        >
          {empty ? (
            <button
              type="button"
              disabled={studio.locked}
              onClick={() => {
                monitorMenu.close();
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
                  monitorMenu.close();
                }}
              >
                {action.label}
              </button>
            ))
          )}
        </Popover>
      </section>

      <aside className="studio-queue" onContextMenu={queueMenu.onContextMenu}>
        <header className="studio-pane-head">
          <div>
            <p className="kicker">{tr("queueTitle")}</p>
            <h2>{tr("interviewsCount", { n: studio.videos.length })}</h2>
          </div>
          <IconButton label={tr("cmdAdd")} onClick={() => void studio.onPickFiles()} disabled={studio.locked}>
            <IconPlus />
          </IconButton>
        </header>
        {studio.adding ? <div className="ui-skel" style={{ height: 72 }} /> : null}
        <div className="studio-queue-list">
          {studio.videos.map((video) => (
            <JobCard
              key={video.path}
              dense
              video={video}
              selected={studio.selectedPath === video.path}
              locked={studio.locked}
              working={studio.working}
              showTranslation={
                !video.skipTranslation &&
                wantsTranslation(studio.spokenLang, studio.outputLang, video.spokenCode)
              }
              uiLang={uiLang}
              tr={tr}
              onSelect={() => studio.setSelectedPath(video.path)}
              onRemove={() => studio.setRemovePath(video.path)}
              onRetry={() => void studio.runPipeline([video])}
              onCancel={studio.requestCancel}
              onCopy={(path, title) => void studio.copyText(path, title)}
              onOpenFolder={(path) => void studio.openFolder(path)}
              onImportDavinci={() => void studio.importToDavinci(video)}
            />
          ))}
        </div>
        {empty ? <p className="muted studio-queue-empty">{tr("queueEmpty")}</p> : null}
        <Popover open={queueMenu.point != null} x={queueMenu.point?.x} y={queueMenu.point?.y} onClose={queueMenu.close}>
          <button
            type="button"
            disabled={studio.locked}
            onClick={() => {
              queueMenu.close();
              void studio.onPickFiles();
            }}
          >
            {tr("cmdAdd")}
          </button>
        </Popover>
      </aside>

      <section className="studio-editor">
        <header className="studio-pane-head">
          <div>
            <p className="kicker">{tr("editDockTitle")}</p>
            <h2>{selected ? tr("studioScript") : tr("editDockPick")}</h2>
            {selected ? (
              <p className="muted">
                {languageName(selected.spokenCode || studio.spokenLang, uiLang)}
                {studio.needsTranslation
                  ? ` → ${languageName(selected.outputCode || studio.outputLang, uiLang)}`
                  : ""}
              </p>
            ) : (
              <p className="muted">{tr("editDockHint")}</p>
            )}
          </div>
        </header>
        {selected ? (
          <ScriptPanel
            script={studio.script}
            loading={studio.scriptLoading}
            editable={!studio.working && Boolean(studio.script)}
            saving={studio.scriptSaving}
            currentTime={clock}
            tr={tr}
            onSave={(segments) => void studio.saveEdits(segments)}
            onSeek={seekAll}
            onCopy={(text, title) => void studio.copyText(text, title)}
          />
        ) : (
          <p className="muted">{preparing ? tr("bootChecking") : tr("editDockHint")}</p>
        )}
      </section>
    </div>
  );
}
