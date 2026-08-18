import { useRef, useState } from "react";
import type { GlossaryPreset } from "../lib/glossary";
import { loadPresets, parseTerms, savePresets } from "../lib/glossary";
import type { Msg } from "../lib/i18n";
import { Button } from "../ui/Button";
import { Popover } from "../ui/Popover";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  terms: string[];
  locked: boolean;
  tr: Tr;
  onChange: (terms: string[]) => void;
};

export function GlossaryView({ terms, locked, tr, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<GlossaryPreset[]>(() => loadPresets());
  const [chipMenu, setChipMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addTerm(raw: string) {
    const next = parseTerms(raw);
    if (next.length === 0) {
      return;
    }
    const seen = new Set(terms.map((term) => term.toLowerCase()));
    const merged = [...terms];
    for (const term of next) {
      if (!seen.has(term.toLowerCase())) {
        merged.push(term);
        seen.add(term.toLowerCase());
      }
    }
    onChange(merged);
    setDraft("");
  }

  return (
    <div>
      <div className="page-head">
        <p className="kicker">{tr("glossaryKicker")}</p>
        <h2>{tr("glossaryTitle")}</h2>
        <p>{tr("glossaryLead")}</p>
      </div>

      <div className="glossary-add">
        <input
          value={draft}
          disabled={locked}
          placeholder={tr("glossaryPlaceholder")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTerm(draft);
            }
          }}
        />
        <Button disabled={locked || !draft.trim()} onClick={() => addTerm(draft)}>
          {tr("add")}
        </Button>
        <Button variant="ghost" disabled={locked} onClick={() => fileRef.current?.click()}>
          {tr("import")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            void file.text().then((text) => addTerm(text));
            event.target.value = "";
          }}
        />
      </div>

      <div className="ui-chips">
        {terms.map((term, index) => (
          <span
            key={`${term}-${index}`}
            className="ui-chip"
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setChipMenu({ x: event.clientX, y: event.clientY, index });
            }}
          >
            {editing === index ? (
              <input
                autoFocus
                value={editValue}
                disabled={locked}
                onChange={(event) => setEditValue(event.target.value)}
                onBlur={() => {
                  const value = editValue.trim();
                  onChange(terms.map((item, i) => (i === index ? value || item : item)).filter(Boolean));
                  setEditing(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  setEditing(index);
                  setEditValue(term);
                }}
              >
                {term}
              </button>
            )}
            <button
              type="button"
              aria-label={`Remove ${term}`}
              disabled={locked}
              onClick={() => onChange(terms.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <Popover open={chipMenu != null} x={chipMenu?.x} y={chipMenu?.y} onClose={() => setChipMenu(null)}>
        <button
          type="button"
          className="is-danger"
          disabled={locked}
          onClick={() => {
            if (chipMenu) {
              onChange(terms.filter((_, i) => i !== chipMenu.index));
            }
            setChipMenu(null);
          }}
        >
          {tr("remove")}
        </button>
      </Popover>

      <div className="panel" style={{ marginTop: 24 }}>
        <div className="glossary-add">
          <input
            value={presetName}
            disabled={locked}
            placeholder={tr("presetName")}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <Button
            disabled={locked || terms.length === 0}
            onClick={() => {
              const preset: GlossaryPreset = {
                id: `${Date.now()}`,
                name: presetName.trim() || "Untitled",
                terms: [...terms],
              };
              const next = [preset, ...presets];
              setPresets(next);
              savePresets(next);
            }}
          >
            {tr("savePreset")}
          </Button>
        </div>
        {presets.length === 0 ? (
          <p className="muted">{tr("noPresets")}</p>
        ) : (
          <div className="ui-chips">
            {presets.map((preset) => (
              <span key={preset.id} className="ui-chip">
                <button type="button" disabled={locked} onClick={() => onChange(preset.terms)}>
                  {preset.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${preset.name}`}
                  disabled={locked}
                  onClick={() => {
                    const next = presets.filter((item) => item.id !== preset.id);
                    setPresets(next);
                    savePresets(next);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
