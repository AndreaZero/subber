export const DEFAULT_TERMS = [

];

export type GlossaryPreset = {
  id: string;
  name: string;
  terms: string[];
};

const PRESET_KEY = "video-sub.glossary.presets";
const ACTIVE_KEY = "video-sub.glossary.active";

export function parseTerms(raw: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const line of raw.split(/[\n,;]+/)) {
    const term = line.trim();
    if (!term) {
      continue;
    }
    const key = term.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    terms.push(term);
  }
  return terms;
}

export function serializeTerms(terms: string[]): string {
  return terms.join("\n");
}

export function loadPresets(): GlossaryPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as GlossaryPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresets(presets: GlossaryPreset[]): void {
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

export function loadActiveGlossary(): string {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (raw && raw.trim()) {
      return raw;
    }
  } catch {
    // ignore
  }
  return DEFAULT_TERMS.join("\n");
}

export function saveActiveGlossary(raw: string): void {
  localStorage.setItem(ACTIVE_KEY, raw);
}
