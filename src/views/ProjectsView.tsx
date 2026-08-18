import { useState } from "react";
import type { Msg, UiLang } from "../lib/i18n";
import type { ProjectRecent } from "../lib/projects";
import { Button } from "../ui/Button";
import { IconFolder, IconPlus, IconProjects } from "../ui/icons";
import { SegmentedControl } from "../ui/SegmentedControl";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  recents: ProjectRecent[];
  busy: boolean;
  uiLang: UiLang;
  tr: Tr;
  onUiLang: (lang: UiLang) => void;
  onCreate: (name: string, folder: string) => void;
  onOpenFolder: () => void;
  onOpenRecent: (folder: string) => void;
  onRemoveRecent: (folder: string) => void;
  onPickCreateFolder: () => Promise<string | null>;
};

function formatOpened(at: number, uiLang: UiLang): string {
  return new Date(at).toLocaleString(uiLang === "en" ? "en-GB" : "it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectsView({
  recents,
  busy,
  uiLang,
  tr,
  onUiLang,
  onCreate,
  onOpenFolder,
  onOpenRecent,
  onRemoveRecent,
  onPickCreateFolder,
}: Props) {
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");

  async function pickFolder() {
    const picked = await onPickCreateFolder();
    if (picked) {
      setFolder(picked);
    }
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || !folder.trim() || busy) {
      return;
    }
    onCreate(trimmed, folder.trim());
  }

  return (
    <div className="project-gate">
      <div className="project-shell">
        <header className="project-head">
          <div className="project-brand">
            <img className="brand-mark" src="/icon.png" alt="" width={40} height={40} />
            <div>
              <p className="kicker">{tr("projectsKicker")}</p>
              <h1>{tr("projectsTitle")}</h1>
              <p className="project-lead">{tr("projectsLead")}</p>
            </div>
          </div>
          <SegmentedControl
            value={uiLang}
            options={[
              { id: "it", label: "IT" },
              { id: "en", label: "EN" },
            ]}
            onChange={onUiLang}
          />
        </header>

        <div className="project-layout">
          <section className="project-panel">
            <header className="studio-pane-head">
              <div>
                <h2>{tr("projectsRecent")}</h2>
              </div>
              <span className="queue-count">{recents.length}</span>
            </header>
            {recents.length === 0 ? (
              <div className="project-empty">
                <span className="editor-state-icon">
                  <IconProjects />
                </span>
                <strong>{tr("projectsEmpty")}</strong>
                <p>{tr("projectsEmptyHint")}</p>
              </div>
            ) : (
              <ul className="project-list">
                {recents.map((item) => (
                  <li key={`${item.id}-${item.folder}`}>
                    <button
                      type="button"
                      className="project-card"
                      disabled={busy}
                      onClick={() => onOpenRecent(item.folder)}
                    >
                      <span className="project-card-icon">
                        <IconFolder />
                      </span>
                      <span className="project-card-copy">
                        <b>{item.name}</b>
                        <span>{item.folder}</span>
                        <em>{tr("projectsOpenedAt", { when: formatOpened(item.openedAt, uiLang) })}</em>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="project-forget"
                      disabled={busy}
                      onClick={() => onRemoveRecent(item.folder)}
                    >
                      {tr("projectsRemoveRecent")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="project-panel">
            <header className="studio-pane-head">
              <div>
                <h2>{tr("projectsCreate")}</h2>
              </div>
            </header>
            <form
              className="project-form"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="ui-field">
                <span>{tr("projectsName")}</span>
                <input
                  value={name}
                  disabled={busy}
                  placeholder={tr("projectsNamePlaceholder")}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="ui-field">
                <span>{tr("projectsFolder")}</span>
                <span className="glossary-add" style={{ margin: 0 }}>
                  <input
                    value={folder}
                    disabled={busy}
                    placeholder={tr("projectsFolderPlaceholder")}
                    onChange={(event) => setFolder(event.target.value)}
                  />
                  <Button disabled={busy} onClick={() => void pickFolder()}>
                    {tr("browse")}
                  </Button>
                </span>
              </label>
              <Button
                variant="primary"
                type="submit"
                disabled={busy || !name.trim() || !folder.trim()}
              >
                <IconPlus />
                {busy ? tr("projectsBusy") : tr("projectsCreateOpen")}
              </Button>
            </form>

            <div className="project-open">
              <p className="muted">{tr("projectsOpenHint")}</p>
              <Button variant="ghost" disabled={busy} onClick={onOpenFolder}>
                <IconFolder />
                {tr("projectsOpen")}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
