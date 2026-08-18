export type HistoryEntry = {
  id: string;
  name: string;
  at: number;
  ok: boolean;
  spoken?: string;
  output?: string;
  detail?: string;
};

const KEY = "video-sub.history";
const LIMIT = 40;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
}

export function pushHistory(
  current: HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(
    0,
    LIMIT,
  );
  saveHistory(next);
  return next;
}
