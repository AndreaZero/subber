import type { ReactNode } from "react";

type Props = {
  tone?: "neutral" | "accent" | "ok";
  children: ReactNode;
};

export function Badge({ tone = "neutral", children }: Props) {
  return <span className={`ui-badge ${tone === "neutral" ? "" : `is-${tone}`}`}>{children}</span>;
}
