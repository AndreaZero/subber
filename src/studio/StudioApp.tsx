import { OUTPUT_LANGUAGES, SPOKEN_LANGUAGES, formatClock, formatMediaDuration } from "../lib/files";
import { readHardware } from "../lib/hardware";
import { saveHistory } from "../lib/history";
import { langShort, phaseLabel, QUALITY_PRESETS } from "../lib/pipeline";
import { useStudio } from "../lib/useStudio";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { CommandPalette } from "../ui/CommandPalette";
import { Dialog } from "../ui/Dialog";
import { DropZone } from "../ui/DropZone";
import {
  IconGlossary,
  IconHistory,
  IconHome,
  IconJobs,
  IconSettings,
  IconSidebar,
} from "../ui/icons";
import { IconButton } from "../ui/IconButton";
import { JobCard } from "../ui/JobCard";
import { Metric } from "../ui/Metric";
import { Progress } from "../ui/Progress";
import { SegmentedControl } from "../ui/SegmentedControl";
import { ToastViewport } from "../ui/Toast";
import { Tooltip } from "../ui/Tooltip";
import { GlossaryView } from "../views/GlossaryView";
import { HistoryView } from "../views/HistoryView";
import { SettingsView } from "../views/SettingsView";
import "../styles/tokens.css";
import "../styles/ui.css";
import "../styles/app.css";

const NAV = [
  { id: "home", label: "Home", icon: <IconHome /> },
  { id: "jobs", label: "Jobs", icon: <IconJobs /> },
  { id: "history", label: "History", icon: <IconHistory /> },
  { id: "glossary", label: "Glossary", icon: <IconGlossary /> },
  { id: "settings", label: "Settings", icon: <IconSettings /> },
] as const;

export default function StudioApp() {
  const studio = useStudio();
  const hardware = readHardware();
  const showContext = Boolean(studio.selected) && studio.nav !== "settings";
  const pair = `${langShort(studio.spokenLang)} → ${langShort(studio.outputLang)}`;

  function confirmQuality(next: typeof studio.quality) {
    if (next === "max" && studio.quality !== "max") {
      studio.setPendingQuality(next);
      return;
    }
    studio.setQuality(next);
  }

  const commands = [
    { id: "add", label: "Add videos", hint: "Open picker", run: () => void studio.onPickFiles() },
    {
      id: "start",
      label: "Start processing",
      hint: "Run the pipeline",
      run: () => void studio.runPipeline(),
    },
    {
      id: "output",
      label: "Open output",
      hint: "Copy folder path",
      run: () => {
        if (studio.outputDir) {
          void studio.copyText(studio.outputDir, "Output folder copied");
        } else {
          void studio.onPickOutput();
        }
      },
    },
    {
      id: "term",
      label: "Add glossary term",
      run: () => studio.setNav("glossary"),
    },
    { id: "settings", label: "Settings", run: () => studio.setNav("settings") },
    {
      id: "cancel",
      label: "Cancel current job",
      run: () => studio.requestCancel(),
    },
  ];

  return (
    <div
      className={`shell ${studio.sidebarOpen ? "is-wide" : ""} ${showContext ? "has-context" : ""}`}
    >
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/icon.png" alt="" width={32} height={32} />
          <div>
            <b>Video Sub</b>
            <span>Caravaggio</span>
          </div>
        </div>
        {NAV.map((item) => (
          <Tooltip key={item.id} label={item.label}>
            <button
              type="button"
              className={`nav-btn ${studio.nav === item.id ? "is-on" : ""}`}
              onClick={() => studio.setNav(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          </Tooltip>
        ))}
        <div className="sidebar-foot">
          <IconButton
            label={studio.sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => studio.setSidebarOpen((open) => !open)}
          >
            <IconSidebar />
          </IconButton>
        </div>
      </aside>

      <div className="stage">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{studio.mode === "empty" ? "Studio" : `${studio.videos.length} interviews`}</h1>
            <p>
              {studio.working
                ? `${phaseLabel(studio.phase)} · ${Math.round(studio.progress)}%`
                : "Local transcription and editorial subtitles"}
            </p>
          </div>
          <div className="topbar-cluster">
            <div className="lang-pair">
              <select
                value={studio.spokenLang}
                disabled={studio.working}
                onChange={(event) => studio.setSpokenLang(event.target.value)}
              >
                {SPOKEN_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <em>→</em>
              <select
                value={studio.outputLang}
                disabled={studio.working}
                onChange={(event) => studio.setOutputLang(event.target.value)}
              >
                {OUTPUT_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <SegmentedControl
              value={studio.quality}
              disabled={studio.working}
              options={QUALITY_PRESETS.map((item) => ({ id: item.id, label: item.label }))}
              onChange={confirmQuality}
            />
            {studio.working ? (
              <div className="hw-strip">
                <Metric label="CPU" value={hardware.cpuThreads ? `${hardware.cpuThreads} threads` : "—"} />
                <Metric
                  label="RAM"
                  value={hardware.deviceMemoryGb ? `${hardware.deviceMemoryGb} GB` : "This PC"}
                />
                <Metric label="GPU" value="CPU mode" />
              </div>
            ) : null}
            <Button variant="ghost" onClick={() => studio.setCommandOpen(true)}>
              Ctrl+K
            </Button>
            <Button
              variant="primary"
              disabled={studio.locked || studio.videos.length === 0}
              onClick={() => void studio.runPipeline()}
            >
              {studio.working ? phaseLabel(studio.phase) : "Start"}
            </Button>
          </div>
        </header>

        <main className="workspace">
          <div className="workspace-inner">
            {studio.nav === "glossary" ? (
              <GlossaryView
                terms={studio.terms}
                locked={studio.working}
                onChange={studio.setTerms}
              />
            ) : null}

            {studio.nav === "history" ? (
              <HistoryView
                entries={studio.history}
                onClear={() => studio.setClearHistoryOpen(true)}
              />
            ) : null}

            {studio.nav === "settings" ? (
              <SettingsView
                spokenLang={studio.spokenLang}
                outputLang={studio.outputLang}
                quality={studio.quality}
                outputDir={studio.outputDir}
                locked={studio.locked}
                working={studio.working}
                advancedOpen={studio.advancedOpen}
                logs={studio.logs}
                phase={studio.phase}
                asrModel={studio.qualityMeta.asr}
                beam={studio.qualityMeta.beam}
                onSpoken={studio.setSpokenLang}
                onOutput={studio.setOutputLang}
                onQuality={confirmQuality}
                onOutputDir={studio.setOutputDir}
                onPickOutput={() => void studio.onPickOutput()}
                onToggleAdvanced={() => studio.setAdvancedOpen((open) => !open)}
              />
            ) : null}

            {studio.nav === "home" || studio.nav === "jobs" ? (
              <>
                {studio.mode === "empty" && studio.nav === "home" ? (
                  <div className="empty-home">
                    <DropZone
                      dragging={studio.dragging}
                      disabled={studio.locked}
                      onPick={() => void studio.onPickFiles()}
                    >
                      <div className="drop-meta">
                        <Badge tone="accent">{pair}</Badge>
                        <Badge>Local processing</Badge>
                        <Badge>Private</Badge>
                      </div>
                    </DropZone>
                    {studio.adding ? (
                      <div className="job-list" style={{ width: "min(100%, 640px)", marginTop: 24 }}>
                        <div className="ui-skel" style={{ height: 88 }} />
                        <div className="ui-skel" style={{ height: 88 }} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <DropZone
                      compact
                      dragging={studio.dragging}
                      disabled={studio.locked}
                      onPick={() => void studio.onPickFiles()}
                    />

                    {studio.working || studio.mode === "processing" || studio.mode === "completed" ? (
                      <div className="run-banner">
                        <Metric
                          label="Interviews"
                          value={`${studio.doneCount} / ${studio.videos.length}`}
                        />
                        <div>
                          <Progress value={studio.progress} mint={studio.phase === "translate"} />
                          <div className="stats" style={{ marginTop: 10 }}>
                            <Metric label="Elapsed" value={formatClock(studio.elapsedSecs)} />
                            {studio.processedSecs > 0 ? (
                              <Metric
                                label="Processed"
                                value={formatMediaDuration(studio.processedSecs)}
                              />
                            ) : null}
                            <Metric label="Phase" value={phaseLabel(studio.phase)} />
                            <Metric label="Progress" value={`${Math.round(studio.progress)}%`} />
                          </div>
                        </div>
                        <Button variant="ghost" disabled={!studio.working} onClick={studio.requestCancel}>
                          Stop
                        </Button>
                      </div>
                    ) : null}

                    {studio.adding ? (
                      <div className="job-list">
                        <div className="ui-skel" style={{ height: 132 }} />
                      </div>
                    ) : null}

                    <div className="job-list">
                      {studio.videos.map((video) => (
                        <JobCard
                          key={video.path}
                          video={video}
                          selected={studio.selectedPath === video.path}
                          locked={studio.locked}
                          working={studio.working}
                          onSelect={() => studio.setSelectedPath(video.path)}
                          onRemove={() => studio.setRemovePath(video.path)}
                          onRetry={() => void studio.runPipeline([video])}
                          onCancel={studio.requestCancel}
                          onCopy={(path, title) => void studio.copyText(path, title)}
                        />
                      ))}
                    </div>

                    {studio.mode === "completed" ? (
                      <div className="done-cta" style={{ marginTop: 18 }}>
                        <Button
                          variant="primary"
                          onClick={() => void studio.copyText(studio.outputDir, "Output folder copied")}
                        >
                          Open folder
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            ) : null}
          </div>
        </main>
      </div>

      {showContext && studio.selected ? (
        <aside className="context">
          <h2>Context</h2>
          <div className="context-block">
            <strong>{studio.selected.name}</strong>
            <p className="muted">{studio.selected.parentDir}</p>
          </div>
          <div className="context-block">
            <div className="hw-strip" style={{ display: "flex" }}>
              <Metric label="CPU" value={hardware.cpuThreads ? `${hardware.cpuThreads}` : "—"} />
              <Metric label="RAM" value={hardware.deviceMemoryGb ? `${hardware.deviceMemoryGb} GB` : "—"} />
              <Metric label="GPU" value="CPU mode" />
              <Metric label="VRAM" value="—" />
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Processing stays on this computer. GPU meters appear when the engine reports them.
            </p>
          </div>
          {studio.advancedOpen ? (
            <ul className="log-list">
              {studio.logs.slice(-12).map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <Button variant="ghost" onClick={() => studio.setAdvancedOpen(true)}>
              Advanced logs
            </Button>
          )}
        </aside>
      ) : null}

      <CommandPalette
        open={studio.commandOpen}
        commands={commands}
        onClose={() => studio.setCommandOpen(false)}
      />
      <ToastViewport items={studio.toasts} />

      <Dialog
        open={studio.removePath != null}
        title="Remove this interview?"
        body="It leaves the queue. Files already written on disk stay where they are."
        confirmLabel="Remove"
        danger
        onClose={() => studio.setRemovePath(null)}
        onConfirm={() => {
          const path = studio.removePath;
          studio.setVideos((current) => current.filter((video) => video.path !== path));
          studio.setRemovePath(null);
        }}
      />
      <Dialog
        open={studio.clearHistoryOpen}
        title="Clear history?"
        body="This only clears the local history list, not exported subtitles."
        confirmLabel="Clear"
        danger
        onClose={() => studio.setClearHistoryOpen(false)}
        onConfirm={() => {
          studio.setHistory([]);
          saveHistory([]);
          studio.setClearHistoryOpen(false);
        }}
      />
      <Dialog
        open={studio.pendingQuality != null}
        title="Switch to Best Quality?"
        body="First run may download Whisper large-v3. Interviews will take longer and use more memory."
        confirmLabel="Use Best Quality"
        onClose={() => studio.setPendingQuality(null)}
        onConfirm={() => {
          if (studio.pendingQuality) {
            studio.setQuality(studio.pendingQuality);
          }
          studio.setPendingQuality(null);
        }}
      />
    </div>
  );
}
