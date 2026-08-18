type Props = {
  label: string;
  value: string;
};

export function Metric({ label, value }: Props) {
  return (
    <div className="ui-metric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
