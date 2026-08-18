import { useEffect, useMemo, useState } from "react";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  commands: Command[];
  placeholder: string;
  empty: string;
  label: string;
  onClose: () => void;
};

export function CommandPalette({ open, commands, placeholder, empty, label, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return commands;
    }
    return commands.filter((item) => item.label.toLowerCase().includes(q));
  }, [commands, query]);

  if (!open) {
    return null;
  }

  const current = filtered[Math.min(index, Math.max(0, filtered.length - 1))];

  return (
    <div
      className="cmdk"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="cmdk-box" role="dialog" aria-label={label}>
        <input
          autoFocus
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((value) => Math.min(value + 1, filtered.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((value) => Math.max(value - 1, 0));
            }
            if (event.key === "Enter" && current) {
              event.preventDefault();
              current.run();
              onClose();
            }
          }}
        />
        <ul>
          {filtered.length === 0 ? (
            <li>
              <button type="button" disabled>
                {empty}
              </button>
            </li>
          ) : (
            filtered.map((item, i) => (
              <li key={item.id} className={item === current ? "is-on" : ""}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                >
                  <span>{item.label}</span>
                  {item.hint ? <span className="muted">{item.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
