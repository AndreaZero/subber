import { OUTPUT_LANGUAGES, SPOKEN_LANGUAGES, type QualityPreset } from "../lib/files";
import { QUALITY_PRESETS, TRANSLATION_MODEL, type RunPhase } from "../lib/pipeline";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";

type Props = {
  spokenLang: string;
  outputLang: string;
  quality: QualityPreset;
  outputDir: string;
  locked: boolean;
  working: boolean;
  advancedOpen: boolean;
  logs: string[];
  phase: RunPhase;
  asrModel: string;
  beam: number;
  onSpoken: (value: string) => void;
  onOutput: (value: string) => void;
  onQuality: (value: QualityPreset) => void;
  onOutputDir: (value: string) => void;
  onPickOutput: () => void;
  onToggleAdvanced: () => void;
};

export function SettingsView({
  spokenLang,
  outputLang,
  quality,
  outputDir,
  locked,
  working,
  advancedOpen,
  logs,
  phase,
  asrModel,
  beam,
  onSpoken,
  onOutput,
  onQuality,
  onOutputDir,
  onPickOutput,
  onToggleAdvanced,
}: Props) {
  return (
    <div>
      <div className="page-head">
        <p className="kicker">Controls</p>
        <h2>Settings</h2>
        <p>Keep the simple modes in front. Technical detail stays in Advanced.</p>
      </div>

      <div className="settings-grid">
        <label className="ui-field">
          <span>Spoken language</span>
          <select value={spokenLang} disabled={working} onChange={(event) => onSpoken(event.target.value)}>
            {SPOKEN_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span>Subtitle language</span>
          <select value={outputLang} disabled={working} onChange={(event) => onOutput(event.target.value)}>
            {OUTPUT_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ui-field" style={{ gridColumn: "1 / -1" }}>
          <span>AI mode</span>
          <SegmentedControl
            value={quality}
            disabled={working}
            options={QUALITY_PRESETS.map((item) => ({ id: item.id, label: item.label }))}
            onChange={onQuality}
          />
          <p className="muted">{QUALITY_PRESETS.find((item) => item.id === quality)?.hint}</p>
        </div>
        <label className="ui-field" style={{ gridColumn: "1 / -1" }}>
          <span>Output folder</span>
          <span className="glossary-add">
            <input
              value={outputDir}
              disabled={working}
              placeholder="Where files are written"
              onChange={(event) => onOutputDir(event.target.value)}
            />
            <Button disabled={locked} onClick={onPickOutput}>
              Browse
            </Button>
          </span>
        </label>
      </div>

      <div className="advanced">
        <Button variant="ghost" onClick={onToggleAdvanced}>
          {advancedOpen ? "Hide advanced" : "Advanced"}
        </Button>
        {advancedOpen ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="advanced-grid">
              <div>
                <b>ASR model</b>
                {asrModel}
              </div>
              <div>
                <b>Translation model</b>
                {TRANSLATION_MODEL}
              </div>
              <div>
                <b>Beam size</b>
                {beam}
              </div>
              <div>
                <b>VAD</b>
                On
              </div>
              <div>
                <b>Device</b>
                Detected at runtime
              </div>
              <div>
                <b>CPU threads</b>
                {navigator.hardwareConcurrency || "—"}
              </div>
              <div>
                <b>Phase</b>
                {phase ?? "Idle"}
              </div>
              <div>
                <b>Memory</b>
                Local process
              </div>
            </div>
            <ul className="log-list">
              {logs.length === 0 ? (
                <li>No engine messages yet.</li>
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
