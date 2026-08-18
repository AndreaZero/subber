import { type HistoryEntry } from "../lib/history";
import { langShort } from "../lib/pipeline";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";

type Props = {
  entries: HistoryEntry[];
  onClear: () => void;
};

export function HistoryView({ entries, onClear }: Props) {
  return (
    <div>
      <div className="page-head">
        <p className="kicker">Recent work</p>
        <h2>History</h2>
        <p>Completed and failed interviews from this machine.</p>
      </div>
      {entries.length === 0 ? (
        <p className="muted">Nothing processed yet.</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Button variant="ghost" onClick={onClear}>
              Clear history
            </Button>
          </div>
          {entries.map((entry) => (
            <div key={entry.id} className="history-item">
              <div>
                <strong>{entry.name}</strong>
                <div className="muted">
                  {new Date(entry.at).toLocaleString()}
                  {entry.spoken && entry.output
                    ? ` · ${langShort(entry.spoken)} → ${langShort(entry.output)}`
                    : ""}
                </div>
              </div>
              <StatusPill status={entry.ok ? "completed" : "failed"} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
