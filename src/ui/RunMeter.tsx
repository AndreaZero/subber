import { formatClock } from "../lib/files";
import type { Msg, UiLang } from "../lib/i18n";
import { phaseLabel, type RunPhase } from "../lib/pipeline";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { IconFolder } from "./icons";
import { Progress } from "./Progress";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  active: boolean;
  compact?: boolean;
  working: boolean;
  progress: number;
  phase: RunPhase;
  elapsedSecs: number;
  name?: string;
  done?: boolean;
  outputDir?: string;
  uiLang: UiLang;
  tr: Tr;
  onStop: () => void;
  onOpenFolder?: () => void;
};

export function RunMeter({
  active,
  compact,
  working,
  progress,
  phase,
  elapsedSecs,
  name,
  done,
  outputDir,
  uiLang,
  tr,
  onStop,
  onOpenFolder,
}: Props) {
  if (!active) {
    return null;
  }

  const percent = Math.round(progress);
  const label = working ? phaseLabel(phase, uiLang) : done ? tr("jobTranslated") : phaseLabel(phase, uiLang);

  if (compact) {
    return (
      <div className="sidebar-run is-compact" title={`${name || label} ${percent}%`}>
        <Progress value={percent} mint={phase === "translate"} busy={working} />
      </div>
    );
  }

  return (
    <section className="sidebar-run">
      <header className="sidebar-run-head">
        <p className="sidebar-run-name">{name || label}</p>
        <strong>{percent}%</strong>
      </header>
      <Progress value={percent} mint={phase === "translate"} busy={working} />
      <div className="sidebar-run-meta">
        <span>{label}</span>
        <span>{formatClock(elapsedSecs)}</span>
      </div>
      <div className="sidebar-run-actions">
        <Button variant="ghost" disabled={!working} onClick={onStop}>
          {tr("stop")}
        </Button>
        {done && outputDir && onOpenFolder ? (
          <IconButton label={tr("openFolder")} onClick={onOpenFolder}>
            <IconFolder />
          </IconButton>
        ) : null}
      </div>
    </section>
  );
}
