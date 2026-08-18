import type { ScriptFile, ScriptSegment } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { IconScript } from "./icons";
import { Progress } from "./Progress";
import { ScriptPanel } from "./ScriptPanel";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  title: string;
  script: ScriptFile | null;
  loading: boolean;
  working?: boolean;
  workingLabel?: string;
  workingPercent?: number;
  editable?: boolean;
  saving?: boolean;
  currentTime?: number;
  duration?: number;
  empty?: boolean;
  tr: Tr;
  onSave?: (segments: ScriptSegment[]) => void;
  onSeek?: (time: number) => void;
  onCopy?: (text: string, title: string) => void;
};

export function TranscriptEditor({
  title,
  script,
  loading,
  working,
  workingLabel,
  workingPercent,
  editable,
  saving,
  currentTime,
  duration,
  empty,
  tr,
  onSave,
  onSeek,
  onCopy,
}: Props) {
  const waiting = Boolean(working && !script);
  const vacant = empty || (!loading && !waiting && !script);

  return (
    <section className="studio-editor">
      <header className="studio-pane-head">
        <h2>{title}</h2>
      </header>
      {waiting ? (
        <div className="editor-state is-working">
          <Progress value={workingPercent ?? 0} busy={(workingPercent ?? 0) < 100} />
          <p>{workingLabel || tr("scriptWorking")}</p>
          {workingPercent != null && workingPercent > 0 ? <strong>{Math.round(workingPercent)}%</strong> : null}
        </div>
      ) : vacant && !loading ? (
        <div className="editor-state">
          <span className="editor-state-icon">
            <IconScript />
          </span>
          <b>{tr("editorEmptyTitle")}</b>
          <p>{tr("scriptEmpty")}</p>
        </div>
      ) : loading && !script ? (
        <div className="editor-skel" aria-label={tr("scriptLoading")}>
          <div className="ui-skel" />
          <div className="ui-skel" />
          <div className="ui-skel" />
        </div>
      ) : (
        <ScriptPanel
          script={script}
          loading={loading}
          editable={editable}
          saving={saving}
          currentTime={currentTime}
          duration={duration}
          tr={tr}
          onSave={onSave}
          onSeek={onSeek}
          onCopy={onCopy}
        />
      )}
    </section>
  );
}
