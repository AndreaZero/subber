import { useRef, useState } from "react";
import type { GlossaryPreset } from "../lib/glossary";
import { loadPresets, parseTerms, savePresets } from "../lib/glossary";
import { Button } from "../ui/Button";

type Props = {
  terms: string[];
  locked: boolean;
  onChange: (terms: string[]) => void;
};

export function GlossaryView({ terms, locked, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [presetName, setPresetName] = useState("Caravaggio");
  const [presets, setPresets] = useState<GlossaryPreset[]>(() => loadPresets());
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
        <p className="kicker">Protected terms</p>
        <h2>Glossary</h2>
        <p>Names, places, and works stay exact in transcription and translation.</p>
      </div>

      <div className="glossary-add">
        <input
          value={draft}
          disabled={locked}
          placeholder="Add a term and press Enter"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTerm(draft);
            }
          }}
        />
        <Button disabled={locked || !draft.trim()} onClick={() => addTerm(draft)}>
          Add
        </Button>
        <Button variant="ghost" disabled={locked} onClick={() => fileRef.current?.click()}>
          Import
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
          <span key={`${term}-${index}`} className="ui-chip">
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

      <div className="panel" style={{ marginTop: 24 }}>
        <div className="glossary-add">
          <input
            value={presetName}
            disabled={locked}
            placeholder="Preset name"
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
            Save preset
          </Button>
        </div>
        {presets.length === 0 ? (
          <p className="muted">No saved presets yet.</p>
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
