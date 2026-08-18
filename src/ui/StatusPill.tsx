import type { VideoJobStatus } from "../lib/files";
import type { StageStatus } from "../lib/pipeline";

const LABELS: Record<StageStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  running: "Running",
  completed: "Done",
  warning: "Warning",
  failed: "Failed",
};

function asPill(status: StageStatus | VideoJobStatus): StageStatus {
  switch (status) {
    case "translated":
    case "exported":
    case "transcribed":
    case "audio_ready":
    case "completed":
      return "completed";
    case "error":
    case "failed":
      return "failed";
    case "extracting":
    case "transcribing":
    case "translating":
    case "exporting":
    case "burning":
    case "running":
      return "running";
    case "queued":
    case "pending":
      return "pending";
    case "preparing":
      return "preparing";
    case "warning":
      return "warning";
  }
}

type Props = {
  status: StageStatus | VideoJobStatus;
  label?: string;
};

export function StatusPill({ status, label }: Props) {
  const mapped = asPill(status);
  return <span className={`ui-pill is-${mapped}`}>{label ?? LABELS[mapped]}</span>;
}
