import type { Msg, UiLang } from "../lib/i18n";
import type { PrepareState } from "../lib/useStudio";
import { Button } from "./Button";
import { Progress } from "./Progress";
import { SegmentedControl } from "./SegmentedControl";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  prepare: PrepareState | null;
  checking: boolean;
  error: string | null;
  uiLang: UiLang;
  tr: Tr;
  onRetry: () => void;
  onUiLang: (lang: UiLang) => void;
};

export function BootGate({ prepare, checking, error, uiLang, tr, onRetry, onUiLang }: Props) {
  const percent = Math.round(prepare?.percent ?? (checking ? 4 : 0));
  const message = error
    ? error
    : prepare?.message
      ? prepare.message
      : checking
        ? tr("bootChecking")
        : tr("bootLead");

  return (
    <div className="boot-gate">
      <div className="boot-card">
        <img className="brand-mark" src="/icon.png" alt="" width={40} height={40} />
        <p className="kicker">{tr("bootKicker")}</p>
        <h1>{tr("bootTitle")}</h1>
        <p className="muted">{tr("bootLead")}</p>
        <div className="boot-progress">
          <Progress value={error ? 0 : percent} />
          <p>
            <strong>{error ? "—" : `${percent}%`}</strong>
            <span>{message}</span>
          </p>
        </div>
        {error ? (
          <Button variant="primary" onClick={onRetry}>
            {tr("bootRetry")}
          </Button>
        ) : null}
        <div className="boot-lang">
          <SegmentedControl
            value={uiLang}
            options={[
              { id: "it", label: "IT" },
              { id: "en", label: "EN" },
            ]}
            onChange={onUiLang}
          />
        </div>
      </div>
    </div>
  );
}
