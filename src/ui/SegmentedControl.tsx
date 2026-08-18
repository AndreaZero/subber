type Option<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: Props<T>) {
  return (
    <div className="ui-seg" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={option.id === value}
          className={option.id === value ? "is-on" : ""}
          disabled={disabled}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
