import { useEffect, useRef, useState } from "react";
import {
  cuesDirty,
  formatCueTime,
  insertAtPlayhead,
  insertCue,
  parseTimecode,
  playheadInsertIndex,
  setCueTimes,
  shiftCue,
} from "../lib/cues";
import type { ScriptFile, ScriptSegment } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { IconGrip, IconPlus, IconTrash } from "./icons";
import { Popover } from "./Popover";
import { SegmentedControl } from "./SegmentedControl";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type DraftCue = ScriptSegment & { id: string };

type Props = {
  script: ScriptFile | null;
  loading: boolean;
  editable?: boolean;
  saving?: boolean;
  currentTime?: number;
  duration?: number;
  tr: Tr;
  onSave?: (segments: ScriptSegment[]) => void;
  onSeek?: (time: number) => void;
  onCopy?: (text: string, title: string) => void;
};

let cueSeq = 0;

function nextCueId() {
  cueSeq += 1;
  return `cue-${cueSeq}`;
}

function toDraft(segments: ScriptSegment[]): DraftCue[] {
  return segments.map((item) => ({ ...item, id: nextCueId() }));
}

function plain(cues: DraftCue[]): ScriptSegment[] {
  return cues.map(({ id: _id, ...rest }) => rest);
}

function attachInsert(cues: DraftCue[], next: ScriptSegment[], index: number): DraftCue[] {
  return next.map((cue, i) => {
    if (i === index) {
      return { ...cue, id: nextCueId() };
    }
    const from = i < index ? cues[i] : cues[i - 1];
    return { ...cue, id: from?.id ?? nextCueId() };
  });
}

function TimeField({
  value,
  label,
  disabled,
  onCommit,
}: {
  value: number;
  label: string;
  disabled?: boolean;
  onCommit: (next: number) => void;
}) {
  const [text, setText] = useState(formatCueTime(value));

  useEffect(() => {
    setText(formatCueTime(value));
  }, [value]);

  return (
    <input
      className="script-tc"
      aria-label={label}
      value={text}
      disabled={disabled}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const parsed = parseTimecode(text);
        if (parsed == null) {
          setText(formatCueTime(value));
          return;
        }
        onCommit(parsed);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          (event.target as HTMLInputElement).blur();
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onCommit(value + 0.05);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onCommit(Math.max(0, value - 0.05));
        }
      }}
    />
  );
}

export function ScriptPanel({
  script,
  loading,
  editable,
  saving,
  currentTime,
  duration,
  tr,
  onSave,
  onSeek,
  onCopy,
}: Props) {
  const hasTranslation = Boolean(script?.segments.some((item) => item.translated));
  const [mode, setMode] = useState<"both" | "source" | "target">("both");
  const [draft, setDraft] = useState<DraftCue[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const drag = useRef<{ index: number; x: number; snapshot: DraftCue[] } | null>(null);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const view = hasTranslation ? mode : "source";
  const opts = { videoEnd: duration, bilingual: hasTranslation };

  useEffect(() => {
    setDraft(toDraft(script?.segments ?? []));
  }, [script]);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const state = drag.current;
      if (!state) {
        return;
      }
      const delta = (event.clientX - state.x) / 36;
      const moved = shiftCue(plain(state.snapshot), state.index, delta, durationRef.current);
      setDraft(moved.map((cue, i) => ({ ...cue, id: state.snapshot[i]?.id ?? nextCueId() })));
    }
    function onUp() {
      drag.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const dirty = Boolean(editable && script && cuesDirty(script.segments, plain(draft)));

  if (loading) {
    return <p className="muted">{tr("scriptLoading")}</p>;
  }
  if (!script) {
    return <p className="muted">{tr("scriptEmpty")}</p>;
  }

  function update(index: number, field: "text" | "translated", value: string) {
    setDraft((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function addAt(index: number) {
    setDraft((current) => attachInsert(current, insertCue(plain(current), index, opts), index));
  }

  function addAtClock() {
    const t = currentTime ?? 0;
    setDraft((current) => {
      const index = playheadInsertIndex(plain(current), t);
      return attachInsert(current, insertAtPlayhead(plain(current), t, opts), index);
    });
  }

  function dropAt(index: number) {
    setDraft((current) => current.filter((_, i) => i !== index));
  }

  function timesAt(index: number, start: number, end: number) {
    setDraft((current) => {
      const next = setCueTimes(plain(current), index, start, end);
      return next.map((cue, i) => ({ ...cue, id: current[i]?.id ?? nextCueId() }));
    });
  }

  const active = menu ? draft[menu.index] : null;

  return (
    <div className="script-panel">
      {hasTranslation || editable ? (
        <div className="script-toolbar">
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
          {editable ? (
            <div className="script-toolbar-actions">
              <Button variant="ghost" onClick={addAtClock}>
                {tr("cueAddPlayhead")}
              </Button>
              <IconButton label={tr("cueAdd")} onClick={() => addAt(draft.length)}>
                <IconPlus />
              </IconButton>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="script-scroll">
        <ul className="script-list">
          {editable ? (
            <li className="script-gap">
          <button type="button" onClick={() => addAt(0)} aria-label={tr("cueInsertBetween")}>
                <IconPlus />
                <span>{tr("cueInsertBetween")}</span>
              </button>
            </li>
          ) : null}
          {draft.map((segment, index) => (
            <CueBlock
              key={segment.id}
              segment={segment}
              view={view}
              editable={Boolean(editable)}
              active={currentTime != null && currentTime >= segment.start && currentTime < segment.end}
              tr={tr}
              onSeek={onSeek}
              onMenu={(x, y) => setMenu({ x, y, index })}
              onText={(field, value) => update(index, field, value)}
              onTimes={(start, end) => timesAt(index, start, end)}
              onRemove={() => dropAt(index)}
              onInsertAfter={() => addAt(index + 1)}
              onDragStart={(x) => {
                drag.current = { index, x, snapshot: draft };
              }}
            />
          ))}
        </ul>
      </div>
      {editable && onSave ? (
        <Button variant="primary" disabled={!dirty || saving} onClick={() => onSave(plain(draft))}>
          {saving ? tr("savingEdits") : tr("saveEdits")}
        </Button>
      ) : null}
      <Popover open={menu != null} x={menu?.x} y={menu?.y} onClose={() => setMenu(null)}>
        {active && menu ? (
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
            {editable ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    addAt(menu.index);
                    setMenu(null);
                  }}
                >
                  {tr("cueInsertBefore")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addAt(menu.index + 1);
                    setMenu(null);
                  }}
                >
                  {tr("cueInsertAfter")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dropAt(menu.index);
                    setMenu(null);
                  }}
                >
                  {tr("cueRemove")}
                </button>
              </>
            ) : null}
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

function CueBlock({
  segment,
  view,
  editable,
  active,
  tr,
  onSeek,
  onMenu,
  onText,
  onTimes,
  onRemove,
  onInsertAfter,
  onDragStart,
}: {
  segment: DraftCue;
  view: "both" | "source" | "target";
  editable: boolean;
  active: boolean;
  tr: Tr;
  onSeek?: (time: number) => void;
  onMenu: (x: number, y: number) => void;
  onText: (field: "text" | "translated", value: string) => void;
  onTimes: (start: number, end: number) => void;
  onRemove: () => void;
  onInsertAfter: () => void;
  onDragStart: (x: number) => void;
}) {
  return (
    <>
      <li
        className={`${view === "both" ? "is-pair" : ""} ${active ? "is-now" : ""}`}
        onDoubleClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("textarea") || target.closest("input") || target.closest("button")) {
            return;
          }
          onSeek?.(segment.start + 0.02);
        }}
        onContextMenu={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("textarea") || target.closest("input")) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onMenu(event.clientX, event.clientY);
        }}
      >
        <div className="script-cue-head">
          {editable ? (
            <button
              type="button"
              className="script-grip"
              aria-label={tr("cueMove")}
              title={tr("cueMove")}
              onPointerDown={(event) => {
                event.preventDefault();
                onDragStart(event.clientX);
              }}
            >
              <IconGrip />
            </button>
          ) : null}
          {editable ? (
            <>
              <TimeField
                value={segment.start}
                label={tr("cueStart")}
                onCommit={(start) => onTimes(start, segment.end)}
              />
              <span className="script-tc-sep">–</span>
              <TimeField
                value={segment.end}
                label={tr("cueEnd")}
                onCommit={(end) => onTimes(segment.start, end)}
              />
              <IconButton label={tr("cueRemove")} onClick={onRemove}>
                <IconTrash />
              </IconButton>
            </>
          ) : (
            <button type="button" className="script-time" onClick={() => onSeek?.(segment.start + 0.02)}>
              {formatCueTime(segment.start)} – {formatCueTime(segment.end)}
            </button>
          )}
        </div>
        {view !== "target" ? (
          editable ? (
            <textarea
              value={segment.text}
              rows={2}
              onChange={(event) => onText("text", event.target.value)}
            />
          ) : (
            <p>{segment.text}</p>
          )
        ) : null}
        {view !== "source" && (segment.translated != null || view === "both") ? (
          editable ? (
            <textarea
              className={view === "both" ? "script-translated" : undefined}
              value={segment.translated || ""}
              rows={2}
              onChange={(event) => onText("translated", event.target.value)}
            />
          ) : segment.translated ? (
            <p className={view === "both" ? "script-translated" : undefined}>{segment.translated}</p>
          ) : null
        ) : null}
      </li>
      {editable ? (
        <li className="script-gap">
          <button type="button" onClick={onInsertAfter} aria-label={tr("cueInsertBetween")}>
            <IconPlus />
            <span>{tr("cueInsertBetween")}</span>
          </button>
        </li>
      ) : null}
    </>
  );
}
