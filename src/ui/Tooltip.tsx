import { useState, type ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
};

export function Tooltip({ label, children }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      onMouseEnter={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        setPos({ x: box.left + box.width / 2, y: box.top });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos ? (
        <span className="ui-tooltip" style={{ left: pos.x, top: pos.y - 8, transform: "translate(-50%, -100%)" }}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
