type Props = {
  active?: boolean;
};

const BARS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function Waveform({ active = true }: Props) {
  return (
    <div className={`ui-wave ${active ? "" : "is-paused"}`} aria-hidden="true">
      {BARS.map((index) => (
        <i key={index} style={{ animationDelay: `${index * 70}ms`, height: `${40 + ((index * 17) % 60)}%` }} />
      ))}
    </div>
  );
}
