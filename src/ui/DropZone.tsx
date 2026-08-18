import type { ReactNode } from "react";
import { IconDrop } from "./icons";

type Props = {
  dragging: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPick: () => void;
  children?: ReactNode;
};

export function DropZone({ dragging, disabled, compact, onPick, children }: Props) {
  if (compact) {
    return (
      <button
        type="button"
        className={`compact-drop ${dragging ? "is-dragging" : ""}`}
        onClick={onPick}
        disabled={disabled}
      >
        <span>Drop more interviews, or choose files</span>
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`dropzone ${dragging ? "is-dragging" : ""}`}
      onClick={onPick}
      disabled={disabled}
    >
      <span className="drop-icon">
        <IconDrop />
      </span>
      <h2>Drop your interviews</h2>
      <span className="choose">or choose files</span>
      {children}
    </button>
  );
}
