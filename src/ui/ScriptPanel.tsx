import { useState } from "react";
import { formatMediaDuration, type ScriptFile } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { SegmentedControl } from "./SegmentedControl";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  script: ScriptFile | null;
  loading: boolean;
  tr: Tr;
};

export function ScriptPanel({ script, loading, tr }: Props) {
  const hasTranslation = Boolean(script?.segments.some((item) => item.translated));
  const [mode, setMode] = useState<"both" | "source" | "target">("both");
  const view = hasTranslation ? mode : "source";

  if (loading) {
    return <p className="muted">{tr("scriptLoading")}</p>;
  }
  if (!script || script.segments.length === 0) {
    return <p className="muted">{tr("scriptEmpty")}</p>;
  }

  return (
    <div className="script-panel">
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
        {script.segments.map((segment, index) => (
          <li key={`${segment.start}-${index}`}>
            <time>
              {formatMediaDuration(segment.start)} – {formatMediaDuration(segment.end)}
            </time>
            {view !== "target" ? <p>{segment.text}</p> : null}
            {view !== "source" && segment.translated ? (
              <p className={view === "both" ? "script-translated" : undefined}>{segment.translated}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
