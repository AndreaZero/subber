import { useEffect, useRef, useState } from "react";
import { IconChevron } from "./icons";
import { Popover } from "./Popover";

export type SelectOption = {
  id: string;
  label: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  onChange: (value: string) => void;
};

export function Select({ value, options, disabled, compact, label, onChange }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = options.find((item) => item.id === value) ?? options[0];

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className={`ui-select ${compact ? "is-compact" : ""}`}>
      <button
        ref={btnRef}
        type="button"
        className={`ui-select-btn ${open ? "is-open" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          if (!disabled) {
            setOpen((on) => !on);
          }
        }}
      >
        <span>{current?.label ?? value}</span>
        <IconChevron />
      </button>
      <Popover
        open={open}
        anchor={btnRef}
        exclude={btnRef}
        className="ui-select-menu"
        onClose={() => setOpen(false)}
      >
        <div role="listbox" aria-label={label}>
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              className={item.id === value ? "is-on" : ""}
              onClick={() => pick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}
