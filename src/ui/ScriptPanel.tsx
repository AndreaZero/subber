import { useEffect, useState } from "react";
import { formatMediaDuration, type ScriptFile, type ScriptSegment } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { Button } from "./Button";
import { Popover } from "./Popover";
import { SegmentedControl } from "./SegmentedControl";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  script: ScriptFile | null;
  loading: boolean;
  editable?: boolean;
  saving?: boolean;
  currentTime?: number;
  tr: Tr;
  onSave?: (segments: ScriptSegment[]) => void;
  onSeek?: (time: number) => void;
  onCopy?: (text: string, title: string) => void;
};

export function ScriptPanel({
  script,
  loading,
  editable,
  saving,
  currentTime,
  tr,
  onSave,
  onSeek,
  onCopy,
}: Props) {
  const hasTranslation = Boolean(script?.segments.some((item) => item.translated));
  const [mode, setMode] = useState<"both" | "source" | "target">("both");
  const [draft, setDraft] = useState<ScriptSegment[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const view = hasTranslation ? mode : "source";

  useEffect(() => {
    setDraft(script?.segments ?? []);
  }, [script]);

  const dirty =
    editable &&
    script != null &&
    draft.some((item, index) => {
      const original = script.segments[index];
      return (
        item.text !== original?.text || (item.translated || "") !== (original?.translated || "")
      );
    });

  if (loading) {
    return <p className="muted">{tr("scriptLoading")}</p>;
  }
  if (!script || script.segments.length === 0) {
    return <p className="muted">{tr("scriptEmpty")}</p>;
  }

  function update(index: number, field: "text" | "translated", value: string) {
    setDraft((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  const active = menu ? draft[menu.index] : null;

  return (
    <div className="script-panel">
      {editable ? <p className="muted">{tr("editHint")}</p> : null}
      {hasTranslation ? (
        <SegmentedControl
          value={view}
          options={[
            { id: "both", label: tr("scriptBoth") },
            { id: "source", label: tr("scriptSource") },
            { id: "target", label: tr("scriptTarget") },
          ]}
          onChange={setMode}
        />
      ) : null}
      <ul className="script-list">
        {draft.map((segment, index) => (
          <li
            key={`${segment.start}-${index}`}
            className={`${view === "both" ? "is-pair" : ""} ${
              currentTime != null && currentTime >= segment.start && currentTime < segment.end
                ? "is-now"
                : ""
            }`}
            onContextMenu={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("textarea")) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              setMenu({ x: event.clientX, y: event.clientY, index });
            }}
          >
            <time>
              <button
                type="button"
                className="script-time"
                onClick={() => onSeek?.(segment.start + 0.02)}
              >
                {formatMediaDuration(segment.start)} – {formatMediaDuration(segment.end)}
              </button>
            </time>
            {view !== "target" ? (
              editable ? (
                <textarea
                  value={segment.text}
                  rows={2}
                  onChange={(event) => update(index, "text", event.target.value)}
                />
              ) : (
                <p>{segment.text}</p>
              )
            ) : null}
            {view !== "source" && (segment.translated != null || hasTranslation) ? (
              editable ? (
                <textarea
                  className={view === "both" ? "script-translated" : undefined}
                  value={segment.translated || ""}
                  rows={2}
                  onChange={(event) => update(index, "translated", event.target.value)}
                />
              ) : segment.translated ? (
                <p className={view === "both" ? "script-translated" : undefined}>
                  {segment.translated}
                </p>
              ) : null
            ) : null}
          </li>
        ))}
      </ul>
      {editable && onSave ? (
        <Button
          variant="primary"
          disabled={!dirty || saving}
          onClick={() => onSave(draft)}
        >
          {saving ? tr("savingEdits") : tr("saveEdits")}
        </Button>
      ) : null}
      <Popover open={menu != null} x={menu?.x} y={menu?.y} onClose={() => setMenu(null)}>
        {active ? (
          <>
            <button
              type="button"
              onClick={() => {
                onSeek?.(active.start + 0.02);
                setMenu(null);
              }}
            >
              {tr("goToTime")}
            </button>
            <button
              type="button"
              onClick={() => {
                onCopy?.(active.text, tr("copySource"));
                setMenu(null);
              }}
            >
              {tr("copySource")}
            </button>
            {active.translated ? (
              <button
                type="button"
                onClick={() => {
                  onCopy?.(active.translated || "", tr("copyTarget"));
                  setMenu(null);
                }}
              >
                {tr("copyTarget")}
              </button>
            ) : null}
          </>
        ) : null}
      </Popover>
    </div>
  );
}
