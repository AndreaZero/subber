import { useEffect, useRef, useState } from "react";
import { IconChevron } from "./icons";
import { Popover } from "./Popover";

export type SelectOption = {
  id: string;
  label: string;
  preview?: boolean;
};

type Props = {
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  compact?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  label?: string;
  onChange: (value: string) => void;
};

export function Select({
  value,
  options,
  disabled,
  compact,
  searchable,
  searchPlaceholder,
  emptyLabel,
  label,
  onChange,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((item) => item.id === value);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((item) => item.label.toLowerCase().includes(needle) || item.id.toLowerCase().includes(needle))
    : options;

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) {
      const id = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open, searchable]);

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
        <span style={current?.preview ? { fontFamily: `"${current.id}", sans-serif` } : undefined}>
          {current?.label ?? value}
        </span>
        <IconChevron />
      </button>
      <Popover
        open={open}
        anchor={btnRef}
        exclude={btnRef}
        className={`ui-select-menu ${searchable ? "is-search" : ""}`}
        onClose={() => setOpen(false)}
      >
        {searchable ? (
          <input
            ref={searchRef}
            className="ui-select-search"
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder || label}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        ) : null}
        <div role="listbox" aria-label={label}>
          {visible.length === 0 ? (
            <p className="ui-select-empty">{emptyLabel || "—"}</p>
          ) : (
            visible.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === value}
                className={item.id === value ? "is-on" : ""}
                style={item.preview ? { fontFamily: `"${item.id}", sans-serif` } : undefined}
                onClick={() => pick(item.id)}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      </Popover>
    </div>
  );
}
