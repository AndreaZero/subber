type Props = {
  value: number;
  mint?: boolean;
  busy?: boolean;
};

export function Progress({ value, mint, busy }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const indeterminate = Boolean(busy) && pct < 8;
  return (
    <span
      className={`ui-progress ${mint ? "is-mint" : ""} ${busy ? "is-busy" : ""} ${indeterminate ? "is-indeterminate" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
    >
      <span style={indeterminate ? undefined : { transform: `scaleX(${pct / 100})` }} />
    </span>
  );
}
