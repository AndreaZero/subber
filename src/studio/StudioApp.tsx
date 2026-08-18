import {
  OUTPUT_LANGUAGES,
  SPOKEN_LANGUAGES,
  formatClock,
  formatMediaDuration,
  languageName,
} from "../lib/files";
import { saveHistory } from "../lib/history";
import { langShort, phaseLabel, QUALITY_PRESETS, qualityLabel } from "../lib/pipeline";
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
import { ModelSetup } from "../ui/ModelSetup";
import { Progress } from "../ui/Progress";
import { ScriptPanel } from "../ui/ScriptPanel";
import { SegmentedControl } from "../ui/SegmentedControl";
import { ToastViewport } from "../ui/Toast";
import { Tooltip } from "../ui/Tooltip";
import { GlossaryView } from "../views/GlossaryView";
import { HistoryView } from "../views/HistoryView";
import { SettingsView } from "../views/SettingsView";
import "../styles/tokens.css";
import "../styles/ui.css";
import "../styles/app.css";

export default function StudioApp() {
  const studio = useStudio();
  const { tr, uiLang } = studio;
  const preparing = Boolean(studio.prepare?.active);
  const showTools = studio.nav === "home" || studio.nav === "jobs";
  const pair = `${langShort(studio.spokenLang, uiLang)} → ${langShort(studio.outputLang, uiLang)}`;
  const nav = [
    { id: "home" as const, label: tr("navHome"), icon: <IconHome /> },
    { id: "jobs" as const, label: tr("navJobs"), icon: <IconJobs /> },
    { id: "history" as const, label: tr("navHistory"), icon: <IconHistory /> },
    { id: "glossary" as const, label: tr("navGlossary"), icon: <IconGlossary /> },
    { id: "settings" as const, label: tr("navSettings"), icon: <IconSettings /> },
  ];

  function confirmQuality(next: typeof studio.quality) {
    if (next === "max" && studio.quality !== "max") {
      studio.setPendingQuality(next);
      return;
    }
    studio.setQuality(next);
  }

  const commands = [
    { id: "add", label: tr("cmdAdd"), hint: tr("cmdAddHint"), run: () => void studio.onPickFiles() },
    {
      id: "start",
      label: tr("cmdStart"),
      hint: tr("cmdStartHint"),
      run: () => void studio.runPipeline(),
    },
    {
      id: "output",
      label: tr("cmdOutput"),
      hint: tr("cmdOutputHint"),
      run: () => {
        if (studio.outputDir) {
          void studio.copyText(studio.outputDir, tr("copyFolder"));
        } else {
          void studio.onPickOutput();
        }
      },
    },
    {
      id: "term",
      label: tr("cmdTerm"),
      run: () => studio.setNav("glossary"),
    },
    {
      id: "prepare",
      label: tr("cmdPrepare"),
      hint: tr("cmdPrepareHint"),
      run: () => void studio.downloadModels("all"),
    },
    { id: "settings", label: tr("navSettings"), run: () => studio.setNav("settings") },
    {
      id: "cancel",
      label: tr("cmdCancel"),
      run: () => studio.requestCancel(),
    },
  ];

  return (
    <div className={`shell ${studio.sidebarOpen ? "is-wide" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/icon.png" alt="" width={32} height={32} />
          <div>
            <b>Video Sub</b>
            <span>Caravaggio</span>
          </div>
        </div>
        {nav.map((item) => (
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
            label={studio.sidebarOpen ? tr("collapseSidebar") : tr("expandSidebar")}
            onClick={() => studio.setSidebarOpen((open) => !open)}
          >
            <IconSidebar />
          </IconButton>
        </div>
      </aside>

      <div className="stage">
        <header className="topbar">
          <div className="topbar-title">
            <h1>
              {studio.mode === "empty"
                ? tr("studio")
                : tr("interviewsCount", { n: studio.videos.length })}
            </h1>
            <p>
              {preparing
                ? `${tr("setupDownloading")} · ${Math.round(studio.prepare?.percent ?? 0)}%`
                : studio.working
                  ? `${phaseLabel(studio.phase, uiLang)} · ${Math.round(studio.progress)}%`
                  : tr("tagline")}
            </p>
          </div>
          <div className="topbar-cluster">
            <SegmentedControl
              value={uiLang}
              options={[
                { id: "it", label: "IT" },
                { id: "en", label: "EN" },
              ]}
              onChange={studio.setUiLang}
            />
            <Button variant="ghost" className="cmd-hint" onClick={() => studio.setCommandOpen(true)}>
              Ctrl+K
            </Button>
            <Button
              variant="primary"
              disabled={studio.locked || preparing || studio.videos.length === 0}
              onClick={() => void studio.runPipeline()}
            >
              {studio.working ? phaseLabel(studio.phase, uiLang) : tr("start")}
            </Button>
          </div>
        </header>

        {showTools ? (
          <div className="tools">
            <div className="lang-pair">
              <select
                value={studio.spokenLang}
                disabled={studio.working || preparing}
                onChange={(event) => studio.setSpokenLang(event.target.value)}
              >
                {SPOKEN_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {languageName(lang.id, uiLang)}
                  </option>
                ))}
              </select>
              <em>→</em>
              <select
                value={studio.outputLang}
                disabled={studio.working || preparing}
                onChange={(event) => studio.setOutputLang(event.target.value)}
              >
                {OUTPUT_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {languageName(lang.id, uiLang)}
                  </option>
                ))}
              </select>
            </div>
            <SegmentedControl
              value={studio.quality}
              disabled={studio.working || preparing}
              options={QUALITY_PRESETS.map((item) => ({
                id: item.id,
                label: qualityLabel(item.id, uiLang),
              }))}
              onChange={confirmQuality}
            />
          </div>
        ) : null}

        <main className="workspace">
          <div className="workspace-inner">
            {studio.nav === "glossary" ? (
              <GlossaryView
                terms={studio.terms}
                locked={studio.working}
                tr={tr}
                onChange={studio.setTerms}
              />
            ) : null}

            {studio.nav === "history" ? (
              <HistoryView
                entries={studio.history}
                uiLang={uiLang}
                tr={tr}
                onClear={() => studio.setClearHistoryOpen(true)}
              />
            ) : null}

            {studio.nav === "settings" ? (
              <SettingsView
                spokenLang={studio.spokenLang}
                outputLang={studio.outputLang}
                quality={studio.quality}
                outputDir={studio.outputDir}
                locked={studio.locked || preparing}
                working={studio.working || preparing}
                advancedOpen={studio.advancedOpen}
                logs={studio.logs}
                phase={studio.phase}
                asrModel={studio.qualityMeta.asr}
                beam={studio.qualityMeta.beam}
                uiLang={uiLang}
                tr={tr}
                onSpoken={studio.setSpokenLang}
                onOutput={studio.setOutputLang}
                onQuality={confirmQuality}
                onOutputDir={studio.setOutputDir}
                onPickOutput={() => void studio.onPickOutput()}
                onToggleAdvanced={() => studio.setAdvancedOpen((open) => !open)}
                onUiLang={studio.setUiLang}
                engine={studio.engine}
                prepare={studio.prepare}
                onDownloadModels={studio.downloadModels}
              />
            ) : null}

            {studio.nav === "home" || studio.nav === "jobs" ? (
              <>
                {studio.mode === "empty" && studio.nav === "home" ? (
                  <div className="empty-home">
                    <ModelSetup
                      variant="card"
                      engine={studio.engine}
                      prepare={studio.prepare}
                      quality={studio.quality}
                      locked={studio.working}
                      tr={tr}
                      onDownload={studio.downloadModels}
                      onDefer={studio.deferModels}
                    />
                    <DropZone
                      dragging={studio.dragging}
                      disabled={studio.locked}
                      title={tr("dropTitle")}
                      choose={tr("dropChoose")}
                      onPick={() => void studio.onPickFiles()}
                    >
                      <div className="drop-meta">
                        <Badge tone="accent">{pair}</Badge>
                        <Badge>{tr("localPrivate")}</Badge>
                        <Badge>{tr("private")}</Badge>
                      </div>
                    </DropZone>
                    {studio.adding ? (
                      <div className="job-list" style={{ width: "min(100%, 640px)", marginTop: 8 }}>
                        <div className="ui-skel" style={{ height: 88 }} />
                        <div className="ui-skel" style={{ height: 88 }} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <ModelSetup
                      variant="banner"
                      engine={studio.engine}
                      prepare={studio.prepare}
                      quality={studio.quality}
                      locked={studio.working}
                      tr={tr}
                      onDownload={studio.downloadModels}
                    />
                    <DropZone
                      compact
                      dragging={studio.dragging}
                      disabled={studio.locked}
                      title={tr("dropTitle")}
                      choose={tr("dropMore")}
                      onPick={() => void studio.onPickFiles()}
                    />

                    {studio.working || studio.mode === "processing" || studio.mode === "completed" ? (
                      <div className="run-banner">
                        <Metric
                          label={tr("metricInterviews")}
                          value={`${studio.doneCount} / ${studio.videos.length}`}
                        />
                        {studio.failCount > 0 ? (
                          <Metric label={tr("metricFailed")} value={`${studio.failCount}`} />
                        ) : null}
                        <div className="run-banner-main">
                          <Progress value={studio.progress} mint={studio.phase === "translate"} />
                          <div className="stats">
                            <Metric label={tr("metricElapsed")} value={formatClock(studio.elapsedSecs)} />
                            {studio.processedSecs > 0 ? (
                              <Metric
                                label={tr("metricProcessed")}
                                value={formatMediaDuration(studio.processedSecs)}
                              />
                            ) : null}
                            <Metric label={tr("metricPhase")} value={phaseLabel(studio.phase, uiLang)} />
                            <Metric
                              label={tr("metricProgress")}
                              value={`${Math.round(studio.progress)}%`}
                            />
                          </div>
                        </div>
                        <Button variant="ghost" disabled={!studio.working} onClick={studio.requestCancel}>
                          {tr("stop")}
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
                          uiLang={uiLang}
                          tr={tr}
                          onSelect={() => studio.setSelectedPath(video.path)}
                          onRemove={() => studio.setRemovePath(video.path)}
                          onRetry={() => void studio.runPipeline([video])}
                          onCancel={studio.requestCancel}
                          onCopy={(path, title) => void studio.copyText(path, title)}
                        />
                      ))}
                    </div>

                    {studio.mode === "completed" ? (
                      <div className="done-cta">
                        <Button
                          variant="primary"
                          onClick={() => void studio.copyText(studio.outputDir, tr("copyFolder"))}
                        >
                          {tr("openFolder")}
                        </Button>
                      </div>
                    ) : null}

                    {studio.videos.length > 0 ? (
                      <section className="editor-dock">
                        <div className="editor-head">
                          {studio.selected?.frames && studio.selected.frames.length > 0 ? (
                            <div className="editor-frames">
                              {studio.selected.frames.map((frame, index) => (
                                <img key={index} src={frame} alt="" />
                              ))}
                            </div>
                          ) : null}
                          <div>
                            <p className="kicker">{tr("editDockTitle")}</p>
                            <h2>{studio.selected?.name ?? tr("editDockPick")}</h2>
                            <p className="muted">
                              {studio.selected?.parentDir ?? tr("editDockHint")}
                            </p>
                          </div>
                        </div>
                        {studio.selected ? (
                          <ScriptPanel
                            script={studio.script}
                            loading={studio.scriptLoading}
                            editable={!studio.working && Boolean(studio.script)}
                            saving={studio.scriptSaving}
                            tr={tr}
                            onSave={(segments) => void studio.saveEdits(segments)}
                          />
                        ) : (
                          <p className="muted">{tr("editDockHint")}</p>
                        )}
                      </section>
                    ) : null}
                  </>
                )}
              </>
            ) : null}
          </div>
        </main>
      </div>

      <CommandPalette
        open={studio.commandOpen}
        commands={commands}
        placeholder={tr("cmdSearch")}
        empty={tr("cmdEmpty")}
        label={tr("cmdPalette")}
        onClose={() => studio.setCommandOpen(false)}
      />
      <ToastViewport items={studio.toasts} />

      <Dialog
        open={studio.removePath != null}
        title={tr("removeTitle")}
        body={tr("removeBody")}
        confirmLabel={tr("remove")}
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
        title={tr("clearHistoryTitle")}
        body={tr("clearHistoryBody")}
        confirmLabel={tr("clear")}
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
        title={tr("qualityTitle")}
        body={tr("qualityBody")}
        confirmLabel={tr("qualityConfirm")}
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
