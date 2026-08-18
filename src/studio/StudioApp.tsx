import {
  OUTPUT_LANGUAGES,
  SPOKEN_LANGUAGES,
  languageName,
} from "../lib/files";
import { saveHistory } from "../lib/history";
import { langShort, phaseLabel, QUALITY_PRESETS, qualityLabel } from "../lib/pipeline";
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
  IconSettings,
  IconSidebar,
} from "../ui/icons";
import { IconButton } from "../ui/IconButton";
import { Popover, useMenuPoint } from "../ui/Popover";
import { SegmentedControl } from "../ui/SegmentedControl";
import { StudioFloor } from "../ui/StudioFloor";
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
  const toolsMenu = useMenuPoint();
  const preparing = Boolean(studio.prepare?.active);
  const showTools = studio.nav === "home" || studio.nav === "jobs";
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

  return (
    <div className={`shell ${studio.sidebarOpen ? "is-wide" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/icon.png" alt="" width={32} height={32} />
          <div>
            <b>Video Sub</b>
            <span>Sub editor</span>
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
          <div
            className="tools"
            onContextMenu={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("select, input, textarea")) {
                return;
              }
              toolsMenu.onContextMenu(event);
            }}
          >
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
              <em>{studio.needsTranslation ? "→" : "="}</em>
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
            <Popover open={toolsMenu.point != null} x={toolsMenu.point?.x} y={toolsMenu.point?.y} onClose={toolsMenu.close}>
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

        <main className={`workspace ${showTools ? "is-studio" : ""}`}>
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
                onCopy={(text, title) => void studio.copyText(text, title)}
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
                needsTranslation={studio.needsTranslation}
              />
            ) : null}

            {studio.nav === "home" || studio.nav === "jobs" ? (
              <StudioFloor studio={studio} pair={pair} preparing={preparing} />
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
