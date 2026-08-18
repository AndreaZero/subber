import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { formatClock, type PrepareProgress } from "../lib/files";
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
  const [live, setLive] = useState({
    percent: prepare?.percent ?? 0,
    message: prepare?.message ?? "",
    part: prepare?.part ?? "engine",
  });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setLive({
      percent: prepare?.percent ?? 0,
      message: prepare?.message ?? "",
      part: prepare?.part ?? "engine",
    });
  }, [prepare?.percent, prepare?.message, prepare?.part]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen<PrepareProgress>("prepare-progress", (event) => {
      const payload = event.payload;
      setLive({
        percent: payload.percent ?? 0,
        message: payload.message,
        part: payload.part,
      });
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (error) {
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [error, prepare?.active]);

  const percent = Math.round(live.percent || (checking ? 4 : 0));
  const busy = !error;
  const message = error
    ? error
    : live.message
      ? live.message
      : checking
        ? tr("bootChecking")
        : tr("bootLead");

  return (
    <div className="boot-gate">
      <div className="boot-card">
        <div className="boot-brand">
          <img className="brand-mark" src="/icon.png" alt="" width={40} height={40} />
          {busy ? <span className="boot-spinner" aria-hidden="true" /> : null}
        </div>
        <p className="kicker">{tr("bootKicker")}</p>
        <h1>{tr("bootTitle")}</h1>
        <p className="muted">{tr("bootLead")}</p>
        <div className="boot-progress">
          <Progress value={error ? 0 : percent} busy={busy} />
          <p>
            <strong>{error ? "—" : `${percent}%`}</strong>
            <span>{message}</span>
          </p>
          {busy ? (
            <p className="muted">{tr("bootWorking", { time: formatClock(elapsed) })}</p>
          ) : null}
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
