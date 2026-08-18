import { useMemo, useState } from "react";
import { groupHistory, isOtherHistory, type HistoryEntry } from "../lib/history";
import type { Msg, UiLang } from "../lib/i18n";
import { langShort } from "../lib/pipeline";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { IconFolder, IconProjects } from "../ui/icons";
import { Popover } from "../ui/Popover";
import { StatusPill } from "../ui/StatusPill";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  entries: HistoryEntry[];
  currentProjectId?: string;
  uiLang: UiLang;
  tr: Tr;
  onClear: () => void;
  onCopy?: (text: string, title: string) => void;
  onOpenFolder?: (path: string) => void;
};

export function HistoryView({
  entries,
  currentProjectId,
  uiLang,
  tr,
  onClear,
  onCopy,
  onOpenFolder,
}: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; entry: HistoryEntry } | null>(null);
  const groups = useMemo(
    () => groupHistory(entries, currentProjectId),
    [entries, currentProjectId],
  );

  return (
    <div className={`history-page ${entries.length === 0 ? "is-empty" : ""}`}>
      <div className="page-head">
        <p className="kicker">{tr("historyKicker")}</p>
        <h2>{tr("historyTitle")}</h2>
        <p>{tr("historyLead")}</p>
      </div>
      {entries.length === 0 ? (
        <section className="history-panel">
          <div className="project-empty">
            <strong>{tr("nothingYet")}</strong>
            <p>{tr("historyEmptyHint")}</p>
          </div>
        </section>
      ) : (
        <>
          <div className="history-toolbar">
            <Button variant="ghost" onClick={onClear}>
              {tr("clearHistory")}
            </Button>
          </div>
          {groups.map((group) => {
            const other = isOtherHistory(group.key) || !group.name;
            const title = other ? tr("historyOther") : group.name;
            const current = Boolean(currentProjectId && group.key === currentProjectId);
            return (
              <section key={group.key} className="history-panel">
                <header className="studio-pane-head">
                  <div>
                    <h2>
                      <IconProjects />
                      {title}
                    </h2>
                    {group.folder ? <p className="muted">{group.folder}</p> : null}
                  </div>
                  <div className="studio-pane-actions">
                    {current ? <Badge>{tr("historyThisProject")}</Badge> : null}
                    <span className="queue-count">{group.items.length}</span>
                    {group.folder && onOpenFolder ? (
                      <Button variant="ghost" onClick={() => onOpenFolder(group.folder!)}>
                        <IconFolder />
                        {tr("historyOpenProject")}
                      </Button>
                    ) : null}
                  </div>
                </header>
                <ul className="history-list">
                  {group.items.map((entry) => (
                    <li
                      key={entry.id}
                      className="history-item"
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMenu({ x: event.clientX, y: event.clientY, entry });
                      }}
                    >
                      <div className="history-item-copy">
                        <strong>{entry.name}</strong>
                        <span>
                          {new Date(entry.at).toLocaleString(uiLang === "it" ? "it-IT" : "en-GB")}
                          {entry.spoken && entry.output
                            ? ` · ${langShort(entry.spoken, uiLang)} → ${langShort(entry.output, uiLang)}`
                            : ""}
                        </span>
                        {entry.parentDir ? <span>{entry.parentDir}</span> : null}
                      </div>
                      <StatusPill
                        status={entry.ok ? "completed" : "failed"}
                        label={entry.ok ? tr("jobTranslated") : tr("jobError")}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
      <Popover open={menu != null} x={menu?.x} y={menu?.y} onClose={() => setMenu(null)}>
        {menu ? (
          <>
            <button
              type="button"
              onClick={() => {
                onCopy?.(menu.entry.name, tr("toastCopied"));
                setMenu(null);
              }}
            >
              {tr("copyName")}
            </button>
            {menu.entry.projectFolder && onOpenFolder ? (
              <button
                type="button"
                onClick={() => {
                  onOpenFolder(menu.entry.projectFolder!);
                  setMenu(null);
                }}
              >
                {tr("historyOpenProject")}
              </button>
            ) : null}
            {menu.entry.parentDir && onOpenFolder ? (
              <button
                type="button"
                onClick={() => {
                  onOpenFolder(menu.entry.parentDir!);
                  setMenu(null);
                }}
              >
                {tr("historyOpenVideo")}
              </button>
            ) : null}
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                setMenu(null);
                onClear();
              }}
            >
              {tr("clearHistory")}
            </button>
          </>
        ) : null}
      </Popover>
    </div>
  );
}
