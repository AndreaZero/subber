import type { ScriptSegment } from "./files";

const MIN_DUR = 0.28;
const PREFERRED = 1.8;

function roundCue(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

export function formatCueTime(totalSecs: number): string {
  const cs = Math.round(Math.max(0, totalSecs) * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const frac = cs % 100;
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  const tail = `${pad(s)}.${pad(frac)}`;
  if (h > 0) {
    return `${h}:${pad(m)}:${tail}`;
  }
  return `${m}:${tail}`;
}

export function parseTimecode(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text) {
    return null;
  }
  const parts = text.split(":");
  if (parts.some((part) => part === "" || Number.isNaN(Number(part))) || parts.length > 3) {
    return null;
  }
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) {
    return null;
  }
  if (nums.length === 1) {
    return roundCue(nums[0]);
  }
  if (nums.length === 2) {
    return roundCue(nums[0] * 60 + nums[1]);
  }
  return roundCue(nums[0] * 3600 + nums[1] * 60 + nums[2]);
}

export function blankCue(start: number, end: number, bilingual: boolean): ScriptSegment {
  return {
    start: roundCue(start),
    end: roundCue(Math.max(start + MIN_DUR, end)),
    text: "",
    translated: bilingual ? "" : null,
    speaker: null,
    confidence: null,
  };
}

function cloneCue(segment: ScriptSegment): ScriptSegment {
  return { ...segment };
}

function placeInGap(from: number, to: number): [number, number] | null {
  const gap = to - from;
  if (gap < MIN_DUR) {
    return null;
  }
  if (gap >= PREFERRED + 0.24) {
    const mid = (from + to) / 2;
    return [mid - PREFERRED / 2, mid + PREFERRED / 2];
  }
  return [from, to];
}

function stealGap(
  prev: ScriptSegment,
  next: ScriptSegment,
): { prev: ScriptSegment; next: ScriptSegment; start: number; end: number } {
  const steal = 0.4;
  const takeL = Math.min(steal, Math.max(0, prev.end - prev.start - MIN_DUR));
  const takeR = Math.min(steal, Math.max(0, next.end - next.start - MIN_DUR));
  let left = prev.end - takeL;
  let right = next.start + takeR;
  if (right - left < MIN_DUR) {
    const mid = (left + right) / 2;
    left = mid - MIN_DUR / 2;
    right = mid + MIN_DUR / 2;
  }
  left = Math.max(prev.start + MIN_DUR, left);
  right = Math.min(next.end - MIN_DUR, right);
  if (right - left < MIN_DUR) {
    left = Math.max(prev.start, (prev.end + next.start) / 2 - MIN_DUR / 2);
    right = left + MIN_DUR;
  }
  return {
    prev: { ...prev, end: roundCue(left) },
    next: { ...next, start: roundCue(right) },
    start: roundCue(left),
    end: roundCue(right),
  };
}

export function insertCue(
  segments: ScriptSegment[],
  index: number,
  opts: { playhead?: number; videoEnd?: number; bilingual?: boolean } = {},
): ScriptSegment[] {
  const at = Math.max(0, Math.min(segments.length, index));
  const bilingual = Boolean(opts.bilingual);
  const videoEnd = opts.videoEnd && opts.videoEnd > 0 ? opts.videoEnd : undefined;
  const list = segments.map(cloneCue);
  const prev = at > 0 ? list[at - 1] : null;
  const next = at < list.length ? list[at] : null;
  const gapFrom = prev ? prev.end : 0;
  const gapTo = next ? next.start : videoEnd && videoEnd > gapFrom ? videoEnd : gapFrom + PREFERRED;
  const head = opts.playhead;
  let placed = placeInGap(gapFrom, gapTo);

  if (head != null && Number.isFinite(head) && head >= gapFrom && head < gapTo) {
    const wishStart = Math.max(gapFrom, head);
    const wishEnd = Math.min(gapTo, wishStart + PREFERRED);
    if (wishEnd - wishStart >= MIN_DUR) {
      placed = [wishStart, wishEnd];
    }
  }

  let start: number;
  let end: number;
  if (placed) {
    [start, end] = placed;
  } else if (prev && next) {
    const stolen = stealGap(prev, next);
    list[at - 1] = stolen.prev;
    list[at] = stolen.next;
    start = stolen.start;
    end = stolen.end;
  } else if (!prev && next) {
    const cut = Math.min(PREFERRED, Math.max(MIN_DUR, (next.end - next.start) * 0.35));
    start = 0;
    end = next.start > MIN_DUR ? Math.min(PREFERRED, next.start) : cut;
    if (end >= next.start) {
      list[at] = { ...next, start: roundCue(Math.max(end, next.start + 0.01)) };
    }
  } else {
    start = gapFrom;
    end = Math.min(gapTo, start + PREFERRED);
  }

  if (end - start < MIN_DUR) {
    end = start + MIN_DUR;
  }
  return [...list.slice(0, at), blankCue(start, end, bilingual), ...list.slice(at)];
}

export function playheadInsertIndex(segments: ScriptSegment[], playhead: number): number {
  const t = roundCue(playhead);
  const inside = segments.findIndex((item) => t >= item.start && t < item.end);
  if (inside >= 0) {
    return inside + 1;
  }
  const index = segments.findIndex((item) => t < item.start);
  return index < 0 ? segments.length : index;
}

export function insertAtPlayhead(
  segments: ScriptSegment[],
  playhead: number,
  opts: { videoEnd?: number; bilingual?: boolean } = {},
): ScriptSegment[] {
  const t = roundCue(playhead);
  const inside = segments.findIndex((item) => t >= item.start && t < item.end);
  if (inside >= 0) {
    return insertCue(segments, inside + 1, { ...opts, playhead: t });
  }
  let index = segments.findIndex((item) => t < item.start);
  if (index < 0) {
    index = segments.length;
  }
  return insertCue(segments, index, { ...opts, playhead: t });
}

export function removeCue(segments: ScriptSegment[], index: number): ScriptSegment[] {
  return segments.filter((_, i) => i !== index);
}

export function shiftCue(
  segments: ScriptSegment[],
  index: number,
  delta: number,
  videoEnd?: number,
): ScriptSegment[] {
  const item = segments[index];
  if (!item) {
    return segments;
  }
  const dur = Math.max(MIN_DUR, item.end - item.start);
  const prevEnd = index > 0 ? segments[index - 1].end : 0;
  const nextStart = index < segments.length - 1 ? segments[index + 1].start : videoEnd && videoEnd > 0 ? videoEnd : Number.POSITIVE_INFINITY;
  let start = item.start + delta;
  start = Math.max(prevEnd, start);
  start = Math.min(nextStart - dur, start);
  start = Math.max(0, start);
  return segments.map((cue, i) =>
    i === index ? { ...cue, start: roundCue(start), end: roundCue(start + dur) } : cue,
  );
}

export function setCueTimes(
  segments: ScriptSegment[],
  index: number,
  start: number,
  end: number,
): ScriptSegment[] {
  const item = segments[index];
  if (!item) {
    return segments;
  }
  const prevEnd = index > 0 ? segments[index - 1].end : 0;
  const nextStart = index < segments.length - 1 ? segments[index + 1].start : Number.POSITIVE_INFINITY;
  let nextStartTime = roundCue(Math.max(prevEnd, start));
  let nextEnd = roundCue(Math.min(nextStart, end));
  if (nextEnd - nextStartTime < MIN_DUR) {
    nextEnd = roundCue(nextStartTime + MIN_DUR);
    if (nextEnd > nextStart) {
      nextEnd = roundCue(nextStart);
      nextStartTime = roundCue(Math.max(prevEnd, nextEnd - MIN_DUR));
    }
  }
  return segments.map((cue, i) => (i === index ? { ...cue, start: nextStartTime, end: nextEnd } : cue));
}

export function cuesDirty(original: ScriptSegment[] | undefined, draft: ScriptSegment[]): boolean {
  if (!original || original.length !== draft.length) {
    return true;
  }
  return draft.some((item, index) => {
    const prev = original[index];
    return (
      item.start !== prev.start ||
      item.end !== prev.end ||
      item.text !== prev.text ||
      (item.translated || "") !== (prev.translated || "")
    );
  });
}
