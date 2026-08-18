import type { ReactNode } from "react";
import { IconDrop } from "./icons";

type Props = {
  dragging: boolean;
  disabled?: boolean;
  compact?: boolean;
  title: string;
  choose: string;
  onPick: () => void;
  children?: ReactNode;
};

export function DropZone({ dragging, disabled, compact, title, choose, onPick, children }: Props) {
  if (compact) {
    return (
      <button
        type="button"
        className={`compact-drop ${dragging ? "is-dragging" : ""}`}
        onClick={onPick}
        disabled={disabled}
      >
        <span>{choose}</span>
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
      <h2>{title}</h2>
      <span className="choose">{choose}</span>
      {children}
    </button>
  );
}
