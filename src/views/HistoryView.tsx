import { type HistoryEntry } from "../lib/history";
import type { Msg, UiLang } from "../lib/i18n";
import { langShort } from "../lib/pipeline";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  entries: HistoryEntry[];
  uiLang: UiLang;
  tr: Tr;
  onClear: () => void;
};

export function HistoryView({ entries, uiLang, tr, onClear }: Props) {
  return (
    <div>
      <div className="page-head">
        <p className="kicker">{tr("historyKicker")}</p>
        <h2>{tr("historyTitle")}</h2>
        <p>{tr("historyLead")}</p>
      </div>
      {entries.length === 0 ? (
        <p className="muted">{tr("nothingYet")}</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Button variant="ghost" onClick={onClear}>
              {tr("clearHistory")}
            </Button>
          </div>
          {entries.map((entry) => (
            <div key={entry.id} className="history-item">
              <div>
                <strong>{entry.name}</strong>
                <div className="muted">
                  {new Date(entry.at).toLocaleString(uiLang === "it" ? "it-IT" : "en-GB")}
                  {entry.spoken && entry.output
                    ? ` · ${langShort(entry.spoken, uiLang)} → ${langShort(entry.output, uiLang)}`
                    : ""}
                </div>
              </div>
              <StatusPill
                status={entry.ok ? "completed" : "failed"}
                label={entry.ok ? tr("jobTranslated") : tr("jobError")}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
