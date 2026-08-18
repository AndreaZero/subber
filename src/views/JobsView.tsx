import { wantsTranslation } from "../lib/pipeline";
import type { useStudio } from "../lib/useStudio";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DropZone } from "../ui/DropZone";
import { IconPlus } from "../ui/icons";
import { JobCard } from "../ui/JobCard";

type Studio = ReturnType<typeof useStudio>;

type Props = {
  studio: Studio;
};

export function JobsView({ studio }: Props) {
  const { tr, uiLang } = studio;
  const empty = studio.videos.length === 0;

  return (
    <div className="jobs-page">
      <div className="page-head">
        <p className="kicker">{tr("jobsKicker")}</p>
        <h2>{tr("jobsTitle")}</h2>
        <p>{tr("jobsLead")}</p>
      </div>

      <section className="jobs-panel">
        {empty ? (
          <DropZone
            dragging={studio.dragging}
            disabled={studio.locked}
            title={tr("dropTitle")}
            choose={tr("dropChoose")}
            onPick={() => void studio.onPickFiles()}
          >
            <div className="drop-meta">
              <Badge>{tr("localPrivate")}</Badge>
            </div>
          </DropZone>
        ) : (
          <>
            <header className="studio-pane-head">
              <span className="queue-count">{studio.videos.length}</span>
              <div className="studio-pane-actions">
                <Button disabled={studio.locked} onClick={() => void studio.onPickFiles()}>
                  <IconPlus />
                  {tr("cmdAdd")}
                </Button>
              </div>
            </header>
            <div className="job-list">
              {studio.videos.map((video) => (
                <JobCard
                  key={video.path}
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
                  onSelect={() => {
                    studio.setSelectedPath(video.path);
                    studio.setNav("home");
                  }}
                  onRemove={() => studio.setRemovePath(video.path)}
                  onRetry={() => void studio.runPipeline([video])}
                  onCancel={studio.requestCancel}
                  onCopy={(path, title) => void studio.copyText(path, title)}
                  onOpenFolder={(path) => void studio.openFolder(path)}
                  onImportDavinci={() => void studio.importToDavinci(video)}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
