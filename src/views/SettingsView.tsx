import { OUTPUT_LANGUAGES, SPOKEN_LANGUAGES, languageName, type EngineStatus, type PreparePart, type QualityPreset } from "../lib/files";
import type { Msg, UiLang } from "../lib/i18n";
import { QUALITY_PRESETS, TRANSLATION_MODEL, phaseLabel, qualityHint, qualityLabel, type RunPhase } from "../lib/pipeline";
import type { PrepareState } from "../lib/useStudio";
import { Button } from "../ui/Button";
import { ModelSetup } from "../ui/ModelSetup";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Select } from "../ui/Select";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  spokenLang: string;
  outputLang: string;
  quality: QualityPreset;
  outputDir: string;
  projectName?: string;
  locked: boolean;
  working: boolean;
  advancedOpen: boolean;
  logs: string[];
  phase: RunPhase;
  asrModel: string;
  beam: number;
  uiLang: UiLang;
  tr: Tr;
  onSpoken: (value: string) => void;
  onOutput: (value: string) => void;
  onQuality: (value: QualityPreset) => void;
  onOutputDir: (value: string) => void;
  onProjectName?: (value: string) => void;
  onPickOutput: () => void;
  onToggleAdvanced: () => void;
  onUiLang: (value: UiLang) => void;
  engine: EngineStatus | null;
  prepare: PrepareState | null;
  onDownloadModels: (parts?: PreparePart) => void;
  needsTranslation?: boolean;
};

export function SettingsView({
  spokenLang,
  outputLang,
  quality,
  outputDir,
  projectName,
  locked,
  working,
  advancedOpen,
  logs,
  phase,
  asrModel,
  beam,
  uiLang,
  tr,
  onSpoken,
  onOutput,
  onQuality,
  onOutputDir,
  onProjectName,
  onPickOutput,
  onToggleAdvanced,
  onUiLang,
  engine,
  prepare,
  onDownloadModels,
  needsTranslation = true,
}: Props) {
  return (
    <div>
      <div className="page-head">
        <p className="kicker">{tr("settingsKicker")}</p>
        <h2>{tr("settingsTitle")}</h2>
        <p>{tr("settingsLead")}</p>
      </div>

      <ModelSetup
        variant="settings"
        engine={engine}
        prepare={prepare}
        quality={quality}
        locked={working}
        tr={tr}
        onDownload={onDownloadModels}
        needsTranslation={needsTranslation}
      />

      <div className="settings-grid">
        <div className="ui-field" style={{ gridColumn: "1 / -1" }}>
          <span>{tr("uiLanguage")}</span>
          <SegmentedControl
            value={uiLang}
            options={[
              { id: "it", label: "Italiano" },
              { id: "en", label: "English" },
            ]}
            onChange={onUiLang}
          />
        </div>
        <label className="ui-field">
          <span>{tr("spokenLanguage")}</span>
          <Select
            value={spokenLang}
            disabled={working}
            label={tr("spokenLanguage")}
            options={SPOKEN_LANGUAGES.map((lang) => ({
              id: lang.id,
              label: languageName(lang.id, uiLang),
            }))}
            onChange={onSpoken}
          />
        </label>
        <label className="ui-field">
          <span>{tr("subtitleLanguage")}</span>
          <Select
            value={outputLang}
            disabled={working}
            label={tr("subtitleLanguage")}
            options={OUTPUT_LANGUAGES.map((lang) => ({
              id: lang.id,
              label: languageName(lang.id, uiLang),
            }))}
            onChange={onOutput}
          />
        </label>
        <div className="ui-field" style={{ gridColumn: "1 / -1" }}>
          <span>{tr("aiMode")}</span>
          <SegmentedControl
            value={quality}
            disabled={working}
            options={QUALITY_PRESETS.map((item) => ({
              id: item.id,
              label: qualityLabel(item.id, uiLang),
            }))}
            onChange={onQuality}
          />
          <p className="muted">{qualityHint(quality, uiLang)}</p>
        </div>
        <label className="ui-field" style={{ gridColumn: "1 / -1" }}>
          <span>{tr("settingsProjectName")}</span>
          <input
            value={projectName ?? ""}
            disabled={working || !onProjectName}
            onChange={(event) => onProjectName?.(event.target.value)}
          />
        </label>
        <label className="ui-field" style={{ gridColumn: "1 / -1" }}>
          <span>{tr("settingsProjectFolder")}</span>
          <span className="glossary-add">
            <input
              value={outputDir}
              disabled={working}
              placeholder={tr("projectsFolderPlaceholder")}
              onChange={(event) => onOutputDir(event.target.value)}
            />
            <Button disabled={locked} onClick={onPickOutput}>
              {tr("browse")}
            </Button>
          </span>
        </label>
      </div>

      <div className="advanced">
        <Button variant="ghost" onClick={onToggleAdvanced}>
          {advancedOpen ? tr("hideAdvanced") : tr("advanced")}
        </Button>
        {advancedOpen ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="advanced-grid">
              {engine ? (
                <>
                  <div>
                    <b>FFmpeg</b>
                    {engine.ffmpegOk ? tr("engineFfmpegOk") : tr("engineFfmpegMissing")}
                  </div>
                  <div>
                    <b>Python</b>
                    {engine.pythonOk ? tr("enginePythonOk") : tr("enginePythonMissing")}
                  </div>
                </>
              ) : null}
              <div>
                <b>{tr("asrModel")}</b>
                {asrModel}
              </div>
              <div>
                <b>{tr("translationModel")}</b>
                {TRANSLATION_MODEL}
              </div>
              <div>
                <b>{tr("beamSize")}</b>
                {beam}
              </div>
              <div>
                <b>{tr("vad")}</b>
                {tr("on")}
              </div>
              <div>
                <b>{tr("device")}</b>
                {tr("deviceRuntime")}
              </div>
              <div>
                <b>{tr("cpuThreads")}</b>
                {navigator.hardwareConcurrency || "—"}
              </div>
              <div>
                <b>{tr("phase")}</b>
                {phase ? phaseLabel(phase, uiLang) : tr("idle")}
              </div>
              <div>
                <b>{tr("memory")}</b>
                {tr("localProcess")}
              </div>
            </div>
            <ul className="log-list">
              {logs.length === 0 ? (
                <li>{tr("noLogs")}</li>
              ) : (
                logs.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
