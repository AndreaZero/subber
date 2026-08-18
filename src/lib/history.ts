export type HistoryEntry = {
  id: string;
  name: string;
  at: number;
  ok: boolean;
  spoken?: string;
  output?: string;
  detail?: string;
  videoPath?: string;
  parentDir?: string;
  projectId?: string;
  projectName?: string;
  projectFolder?: string;
};

export type HistoryGroup = {
  key: string;
  name: string;
  folder?: string;
  items: HistoryEntry[];
};

const KEY = "video-sub.history";
const LIMIT = 40;
const OTHER = "__other__";

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

export function parentDirOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut > 0 ? path.slice(0, cut) : path;
}

export function makeHistoryEntry(input: {
  name: string;
  path: string;
  ok: boolean;
  spoken?: string;
  output?: string;
  detail?: string;
  parentDir?: string;
  project?: { id: string; name: string; folder: string } | null;
}): HistoryEntry {
  return {
    id: `${input.path}-${Date.now()}`,
    name: input.name,
    at: Date.now(),
    ok: input.ok,
    spoken: input.spoken,
    output: input.output,
    detail: input.detail,
    videoPath: input.path,
    parentDir: input.parentDir || parentDirOf(input.path),
    projectId: input.project?.id,
    projectName: input.project?.name,
    projectFolder: input.project?.folder,
  };
}

export function groupHistory(
  entries: HistoryEntry[],
  currentProjectId?: string,
): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  const index = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.projectId || entry.projectFolder || OTHER;
    const at = index.get(key);
    if (at == null) {
      index.set(key, groups.length);
      groups.push({
        key,
        name: entry.projectName || "",
        folder: entry.projectFolder,
        items: [entry],
      });
    } else {
      groups[at].items.push(entry);
    }
  }
  groups.sort((a, b) => {
    if (currentProjectId) {
      if (a.key === currentProjectId && b.key !== currentProjectId) {
        return -1;
      }
      if (b.key === currentProjectId && a.key !== currentProjectId) {
        return 1;
      }
    }
    if (a.key === OTHER && b.key !== OTHER) {
      return 1;
    }
    if (b.key === OTHER && a.key !== OTHER) {
      return -1;
    }
    return (b.items[0]?.at ?? 0) - (a.items[0]?.at ?? 0);
  });
  return groups;
}

export function isOtherHistory(key: string): boolean {
  return key === OTHER;
}
