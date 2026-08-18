import { useState } from "react";
import {
  OUTPUT_LANGUAGES,
  SPOKEN_LANGUAGES,
  languageName,
} from "../lib/files";
import { saveHistory } from "../lib/history";
import { langShort, phaseLabel, QUALITY_PRESETS, qualityLabel, isActiveStatus } from "../lib/pipeline";
import { BURN_FITS, BURN_FORMATS, BURN_RESOLUTIONS, type BurnFit, type BurnFormat, type BurnResolution } from "../lib/captions";
import { useStudio } from "../lib/useStudio";
import { BootGate } from "../ui/BootGate";
import { Button } from "../ui/Button";
import { CommandPalette } from "../ui/CommandPalette";
import { Dialog } from "../ui/Dialog";
import {
  IconGlossary,
  IconHistory,
  IconHome,
  IconJobs,
  IconProjects,
  IconSettings,
  IconSidebar,
} from "../ui/icons";
import { IconButton } from "../ui/IconButton";
import { Popover, useMenuPoint } from "../ui/Popover";
import { QueueWidget } from "../ui/QueueWidget";
import { RunMeter } from "../ui/RunMeter";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Select } from "../ui/Select";
import { StudioFloor } from "../ui/StudioFloor";
import { ToastViewport } from "../ui/Toast";
import { Tooltip } from "../ui/Tooltip";
import { GlossaryView } from "../views/GlossaryView";
import { HistoryView } from "../views/HistoryView";
import { JobsView } from "../views/JobsView";
import { ProjectsView } from "../views/ProjectsView";
import { SettingsView } from "../views/SettingsView";
import "../styles/tokens.css";
import "../styles/ui.css";
import "../styles/app.css";

export default function StudioApp() {
  const studio = useStudio();
  const { tr, uiLang } = studio;
  const toolsMenu = useMenuPoint();
  const preparing = Boolean(studio.prepare?.active);
  const showTools = studio.nav === "home" || studio.nav === "jobs";
  const canExportVideo =
    studio.productMode === "video" &&
    Boolean(studio.script && studio.script.segments.length > 0) &&
    !studio.locked &&
    !preparing;
  const [burnOpen, setBurnOpen] = useState(false);
  const [burnFormat, setBurnFormat] = useState<BurnFormat>("mp4");
  const [burnResolution, setBurnResolution] = useState<BurnResolution>("1080");
  const [burnFit, setBurnFit] = useState<BurnFit>("source");
  const pair = studio.needsTranslation
    ? `${langShort(studio.spokenLang, uiLang)} → ${langShort(studio.outputLang, uiLang)}`
    : langShort(studio.spokenLang, uiLang);
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
      id: "exportVideo",
      label: tr("cmdExportVideo"),
      run: () => {
        if (canExportVideo) {
          setBurnOpen(true);
        }
      },
    },
    {
      id: "output",
      label: tr("cmdOutput"),
      hint: tr("cmdOutputHint"),
      run: () => {
        if (studio.outputDir) {
          void studio.openFolder(studio.outputDir);
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
      run: () => void studio.downloadModels(studio.needsTranslation ? "all" : "whisper"),
    },
    {
      id: "projects",
      label: tr("projectsSwitch"),
      run: () => void studio.closeProject(),
    },
    { id: "settings", label: tr("navSettings"), run: () => studio.setNav("settings") },
    {
      id: "cancel",
      label: tr("cmdCancel"),
      run: () => studio.requestCancel(),
    },
  ];

  if (!studio.appReady) {
    return (
      <>
        <BootGate
          prepare={studio.prepare}
          checking={!studio.prepare?.active && !studio.bootError}
          error={studio.bootError}
          uiLang={uiLang}
          tr={tr}
          onRetry={studio.retrySetup}
          onUiLang={studio.setUiLang}
        />
        <ToastViewport items={studio.toasts} />
      </>
    );
  }

  if (!studio.project) {
    return (
      <>
        <ProjectsView
          recents={studio.recents}
          busy={studio.projectBusy}
          uiLang={uiLang}
          tr={tr}
          onUiLang={studio.setUiLang}
          onCreate={(name, folder) => void studio.createProject(name, folder)}
          onOpenFolder={() => void studio.pickOpenProject()}
          onOpenRecent={studio.openRecentProject}
          onRemoveRecent={studio.forgetRecent}
          onPickCreateFolder={studio.pickCreateFolder}
        />
        <ToastViewport items={studio.toasts} />
      </>
    );
  }

  return (
    <div className={`shell ${studio.sidebarOpen ? "is-wide" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/icon.png" alt="" width={32} height={32} />
          <div>
            <b>Video Sub</b>
            <span>{studio.project.name}</span>
          </div>
        </div>
        <Tooltip label={tr("projectsSwitch")}>
          <button
            type="button"
            className="project-switch"
            disabled={studio.working || preparing}
            onClick={() => void studio.closeProject()}
          >
            <IconProjects />
            <span>{tr("projectsSwitch")}</span>
          </button>
        </Tooltip>
        <nav className="sidebar-nav">
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
        </nav>
        <div className="sidebar-work">
          <QueueWidget
            videos={studio.videos}
            selectedPath={studio.selectedPath}
            locked={studio.locked}
            working={studio.working}
            adding={studio.adding}
            compact={!studio.sidebarOpen}
            uiLang={uiLang}
            tr={tr}
            onAdd={() => void studio.onPickFiles()}
            onSelect={(path) => {
              studio.setSelectedPath(path);
              studio.setNav("home");
            }}
            onRemove={(path) => studio.setRemovePath(path)}
            onRetry={(video) => void studio.runPipeline([video])}
            onCancel={studio.requestCancel}
            onCopy={(path, title) => void studio.copyText(path, title)}
            onOpenFolder={(path) => void studio.openFolder(path)}
            onImportDavinci={(video) => void studio.importToDavinci(video)}
          />
          <RunMeter
            active={studio.working || studio.mode === "processing" || studio.mode === "completed"}
            compact={!studio.sidebarOpen}
            working={studio.working}
            progress={studio.progress}
            phase={studio.phase}
            elapsedSecs={studio.elapsedSecs}
            name={
              studio.videos.find((video) => isActiveStatus(video.status))?.name ?? studio.selected?.name
            }
            done={studio.mode === "completed"}
            outputDir={studio.outputDir}
            uiLang={uiLang}
            tr={tr}
            onStop={studio.requestCancel}
            onOpenFolder={() => void studio.openFolder(studio.outputDir)}
          />
        </div>
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
              {studio.mode === "empty" ? tr("studio") : tr("interviewsCount", { n: studio.videos.length })}
              {studio.videos.length > 0 && !studio.working && !preparing ? (
                <span className="topbar-status">
                  {studio.videos.length === 1
                    ? tr("studioReadyOne")
                    : tr("studioReadyMany", { n: studio.videos.length })}
                </span>
              ) : null}
            </h1>
            <p>
              {preparing
                ? `${tr("setupDownloading")} · ${Math.round(studio.prepare?.percent ?? 0)}%`
                : studio.working
                  ? `${phaseLabel(studio.phase, uiLang)} · ${Math.round(studio.progress)}%`
                  : studio.productMode === "video"
                    ? tr("taglineVideo")
                    : tr("tagline")}
            </p>
          </div>
          {showTools ? (
            <div
              className="topbar-tools"
              onContextMenu={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("select, input, textarea, .ui-select")) {
                  return;
                }
                toolsMenu.onContextMenu(event);
              }}
            >
              <SegmentedControl
                value={studio.productMode}
                disabled={studio.working || preparing}
                options={[
                  { id: "srt", label: tr("productSrt") },
                  { id: "video", label: tr("productVideo") },
                ]}
                onChange={studio.setProductMode}
              />
              <div className="lang-pair">
                <Select
                  compact
                  value={studio.spokenLang}
                  disabled={studio.working || preparing}
                  label={tr("spokenLanguage")}
                  options={SPOKEN_LANGUAGES.map((lang) => ({
                    id: lang.id,
                    label: languageName(lang.id, uiLang),
                  }))}
                  onChange={studio.setSpokenLang}
                />
                <em>{studio.needsTranslation ? "→" : "="}</em>
                <Select
                  compact
                  value={studio.outputLang}
                  disabled={studio.working || preparing}
                  label={tr("subtitleLanguage")}
                  options={OUTPUT_LANGUAGES.map((lang) => ({
                    id: lang.id,
                    label: languageName(lang.id, uiLang),
                  }))}
                  onChange={studio.setOutputLang}
                />
                {!studio.needsTranslation ? <span className="lang-same">{tr("sameLangNote")}</span> : null}
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
              <Popover
                open={toolsMenu.point != null}
                x={toolsMenu.point?.x}
                y={toolsMenu.point?.y}
                onClose={toolsMenu.close}
              >
                {QUALITY_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={studio.working || preparing}
                    onClick={() => {
                      confirmQuality(item.id);
                      toolsMenu.close();
                    }}
                  >
                    {qualityLabel(item.id, uiLang)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    toolsMenu.close();
                    if (studio.outputDir) {
                      void studio.openFolder(studio.outputDir);
                    } else {
                      void studio.onPickOutput();
                    }
                  }}
                >
                  {tr("cmdOutput")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toolsMenu.close();
                    studio.setNav("settings");
                  }}
                >
                  {tr("navSettings")}
                </button>
              </Popover>
            </div>
          ) : null}
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
            {showTools && studio.productMode === "video" ? (
              <Button
                variant="subtle"
                disabled={!canExportVideo}
                onClick={() => setBurnOpen(true)}
              >
                {tr("exportVideo")}
              </Button>
            ) : null}
            {showTools ? (
              <Button
                variant="primary"
                disabled={studio.locked || preparing || studio.videos.length === 0}
                onClick={() => void studio.runPipeline()}
              >
                {studio.working
                  ? studio.phase === "extract" && studio.progress < 8
                    ? tr("startingWork")
                    : phaseLabel(studio.phase, uiLang)
                  : tr("start")}
              </Button>
            ) : null}
          </div>
        </header>

        <main className={`workspace ${studio.nav === "home" ? "is-studio" : ""}`}>
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
                currentProjectId={studio.project.id}
                uiLang={uiLang}
                tr={tr}
                onClear={() => studio.setClearHistoryOpen(true)}
                onCopy={(text, title) => void studio.copyText(text, title)}
                onOpenFolder={(path) => void studio.openFolder(path)}
              />
            ) : null}

            {studio.nav === "settings" ? (
              <SettingsView
                spokenLang={studio.spokenLang}
                outputLang={studio.outputLang}
                quality={studio.quality}
                outputDir={studio.outputDir}
                projectName={studio.project.name}
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
                onProjectName={studio.renameProject}
                onPickOutput={() => void studio.onPickOutput()}
                onToggleAdvanced={() => studio.setAdvancedOpen((open) => !open)}
                onUiLang={studio.setUiLang}
                engine={studio.engine}
                prepare={studio.prepare}
                onDownloadModels={studio.downloadModels}
                needsTranslation={studio.needsTranslation}
              />
            ) : null}

            {studio.nav === "jobs" ? <JobsView studio={studio} /> : null}

            {studio.nav === "home" ? (
              <StudioFloor studio={studio} pair={pair} />
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
      <Dialog
        open={burnOpen}
        title={tr("burnTitle")}
        body={tr("burnBody")}
        confirmLabel={tr("burnStart")}
        onClose={() => setBurnOpen(false)}
        onConfirm={() => {
          setBurnOpen(false);
          void studio.runBurn(burnFormat, burnResolution, burnFit);
        }}
      >
        <div className="burn-fields">
          <label>
            <span>{tr("burnFormat")}</span>
            <Select
              value={burnFormat}
              label={tr("burnFormat")}
              options={BURN_FORMATS.map((id) => ({
                id,
                label:
                  id === "mp4" ? tr("burnFormatMp4") : id === "mov" ? tr("burnFormatMov") : tr("burnFormatWebm"),
              }))}
              onChange={(id) => setBurnFormat(id as BurnFormat)}
            />
          </label>
          <label>
            <span>{tr("burnFit")}</span>
            <Select
              value={burnFit}
              label={tr("burnFit")}
              options={BURN_FITS.map((id) => ({
                id,
                label:
                  id === "landscape"
                    ? tr("burnFitLandscape")
                    : id === "portrait"
                      ? tr("burnFitPortrait")
                      : id === "square"
                        ? tr("burnFitSquare")
                        : tr("burnFitSource"),
              }))}
              onChange={(id) => setBurnFit(id as BurnFit)}
            />
          </label>
          <label>
            <span>{tr("burnResolution")}</span>
            <Select
              value={burnResolution}
              label={tr("burnResolution")}
              options={BURN_RESOLUTIONS.map((id) => ({
                id,
                label:
                  id === "source"
                    ? tr("burnResSource")
                    : id === "1080"
                      ? tr("burnRes1080")
                      : id === "1440"
                        ? tr("burnRes1440")
                        : tr("burnRes4k"),
              }))}
              onChange={(id) => setBurnResolution(id as BurnResolution)}
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
