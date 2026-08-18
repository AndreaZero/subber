type Props = {
  value: number;
  mint?: boolean;
};

export function Progress({ value, mint }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span
      className={`ui-progress ${mint ? "is-mint" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <span style={{ transform: `scaleX(${pct / 100})` }} />
    </span>
  );
}
