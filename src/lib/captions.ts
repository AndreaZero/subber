import type { ScriptSegment } from "./files";

export type ProductMode = "srt" | "video";

export type CaptionAlign = "left" | "center" | "right";
export type CaptionBackground = "none" | "box";
export type BurnFormat = "mp4" | "mov" | "webm";
export type BurnResolution = "source" | "1080" | "1440" | "4k";
export type BurnFit = "source" | "landscape" | "portrait" | "square";

export type CaptionStyle = {
  fontFamily: string;
  fontFile?: string;
  fontSize: number;
  fontWeight: 400 | 700;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  background: CaptionBackground;
  backgroundColor: string;
  backgroundOpacity: number;
  align: CaptionAlign;
  x: number;
  y: number;
};

export const CAPTION_FONTS = [
  "Arial",
  "Georgia",
  "Impact",
  "Courier New",
  "Trebuchet MS",
  "Times New Roman",
] as const;

export const BURN_FORMATS: BurnFormat[] = ["mp4", "mov", "webm"];
export const BURN_RESOLUTIONS: BurnResolution[] = ["source", "1080", "1440", "4k"];
export const BURN_FITS: BurnFit[] = ["source", "landscape", "portrait", "square"];

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "Arial",
  fontSize: 48,
  fontWeight: 700,
  color: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 3,
  background: "none",
  backgroundColor: "#000000",
  backgroundOpacity: 0.55,
  align: "center",
  x: 50,
  y: 90,
};

export const CAPTION_GUIDES = [8, 100 / 3, 50, 200 / 3, 92];

const PLAY_RES_X = 1920;
const PLAY_RES_Y = 1080;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function asProductMode(value: unknown): ProductMode {
  return value === "video" ? "video" : "srt";
}

export function parseCaptionStyle(raw: unknown): CaptionStyle {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fontFamily =
    typeof obj.fontFamily === "string" && obj.fontFamily.trim()
      ? obj.fontFamily.trim()
      : DEFAULT_CAPTION_STYLE.fontFamily;
  const fontFile =
    typeof obj.fontFile === "string" && obj.fontFile.trim() ? obj.fontFile.trim() : undefined;
  const fontSize = typeof obj.fontSize === "number" && Number.isFinite(obj.fontSize) ? obj.fontSize : DEFAULT_CAPTION_STYLE.fontSize;
  const fontWeight = obj.fontWeight === 400 || obj.fontWeight === 700 ? obj.fontWeight : DEFAULT_CAPTION_STYLE.fontWeight;
  const outlineWidth =
    typeof obj.outlineWidth === "number" && Number.isFinite(obj.outlineWidth)
      ? obj.outlineWidth
      : DEFAULT_CAPTION_STYLE.outlineWidth;
  const backgroundOpacity =
    typeof obj.backgroundOpacity === "number" && Number.isFinite(obj.backgroundOpacity)
      ? obj.backgroundOpacity
      : DEFAULT_CAPTION_STYLE.backgroundOpacity;
  const x = typeof obj.x === "number" && Number.isFinite(obj.x) ? obj.x : DEFAULT_CAPTION_STYLE.x;
  const y = typeof obj.y === "number" && Number.isFinite(obj.y) ? obj.y : DEFAULT_CAPTION_STYLE.y;
  const align: CaptionAlign = obj.align === "left" || obj.align === "right" ? obj.align : "center";
  const background: CaptionBackground = obj.background === "box" ? "box" : "none";
  return {
    fontFamily,
    fontFile,
    fontSize: clamp(Math.round(fontSize), 18, 120),
    fontWeight,
    color: asHex(obj.color, DEFAULT_CAPTION_STYLE.color),
    outlineColor: asHex(obj.outlineColor, DEFAULT_CAPTION_STYLE.outlineColor),
    outlineWidth: clamp(outlineWidth, 0, 12),
    background,
    backgroundColor: asHex(obj.backgroundColor, DEFAULT_CAPTION_STYLE.backgroundColor),
    backgroundOpacity: clamp(backgroundOpacity, 0, 1),
    align,
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  };
}

export function containRect(
  width: number,
  height: number,
  aspect: number,
): { x: number; y: number; w: number; h: number } {
  if (width <= 0 || height <= 0 || aspect <= 0) {
    return { x: 0, y: 0, w: width, h: height };
  }
  const boxAr = width / height;
  if (boxAr > aspect) {
    const w = height * aspect;
    return { x: (width - w) / 2, y: 0, w, h: height };
  }
  const h = width / aspect;
  return { x: 0, y: (height - h) / 2, w: width, h };
}

export function snapCaption(
  x: number,
  y: number,
  frameW: number,
  frameH: number,
): { x: number; y: number; gx: number | null; gy: number | null } {
  const tx = frameW > 0 ? (8 / frameW) * 100 : 1.2;
  const ty = frameH > 0 ? (8 / frameH) * 100 : 1.2;
  let nx = clamp(x, 0, 100);
  let ny = clamp(y, 0, 100);
  let gx: number | null = null;
  let gy: number | null = null;
  for (const guide of CAPTION_GUIDES) {
    if (Math.abs(nx - guide) <= tx) {
      nx = guide;
      gx = guide;
    }
    if (Math.abs(ny - guide) <= ty) {
      ny = guide;
      gy = guide;
    }
  }
  return { x: nx, y: ny, gx, gy };
}

export function captionCenterH(style: CaptionStyle): CaptionStyle {
  return { ...style, x: 50 };
}

export function captionCenterV(style: CaptionStyle): CaptionStyle {
  return { ...style, y: 50 };
}

export function captionDefaultPos(style: CaptionStyle): CaptionStyle {
  return { ...style, x: DEFAULT_CAPTION_STYLE.x, y: DEFAULT_CAPTION_STYLE.y };
}

export function captionText(segment: ScriptSegment): string {
  const translated = (segment.translated || "").trim();
  return translated || segment.text.trim();
}

export function activeCaption(segments: ScriptSegment[], time: number): ScriptSegment | null {
  return segments.find((item) => time >= item.start && time < item.end) ?? null;
}

export function captionLangTag(code?: string | null): string {
  const cleaned = (code || "und").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return cleaned || "und";
}

export function hexToRgba(hex: string, alpha: number): string {
  const raw = asHex(hex, "#000000").slice(1);
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function hex2(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function assColor(hex: string, opacity = 1): string {
  const raw = asHex(hex, "#FFFFFF").slice(1);
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const a = Math.round((1 - clamp(opacity, 0, 1)) * 255);
  return `&H${hex2(a)}${hex2(b)}${hex2(g)}${hex2(r)}`.toUpperCase();
}

function assTime(secs: number): string {
  const total = Math.max(0, secs);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function assText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r\n|\n|\r/g, "\\N");
}

function assAlign(align: CaptionAlign): number {
  if (align === "left") {
    return 1;
  }
  if (align === "right") {
    return 3;
  }
  return 2;
}

export function asBurnFit(value: unknown): BurnFit {
  return value === "landscape" || value === "portrait" || value === "square" ? value : "source";
}

export function asBurnResolution(value: unknown): BurnResolution {
  return value === "source" || value === "1440" || value === "4k" ? value : "1080";
}

export function burnCanvas(
  sourceW: number,
  sourceH: number,
  resolution: BurnResolution,
  fit: BurnFit,
): { width: number; height: number } {
  const srcW = Math.max(2, sourceW);
  const srcH = Math.max(2, sourceH);
  const aspect =
    fit === "landscape" ? 16 / 9 : fit === "portrait" ? 9 / 16 : fit === "square" ? 1 : srcW / srcH;
  const short = resolution === "1080" ? 1080 : resolution === "1440" ? 1440 : resolution === "4k" ? 2160 : null;
  let width: number;
  let height: number;
  if (short != null) {
    if (aspect >= 1) {
      width = Math.round(short * aspect);
      height = short;
    } else {
      width = short;
      height = Math.round(short / aspect);
    }
  } else if (fit === "source") {
    width = srcW;
    height = srcH;
  } else {
    const long = Math.max(srcW, srcH);
    if (aspect >= 1) {
      width = long;
      height = Math.round(long / aspect);
    } else {
      width = Math.round(long * aspect);
      height = long;
    }
  }
  return { width: Math.max(2, width & ~1), height: Math.max(2, height & ~1) };
}

export function captionsToAss(
  style: CaptionStyle,
  segments: ScriptSegment[],
  playResX = PLAY_RES_X,
  playResY = PLAY_RES_Y,
): string {
  const parsed = parseCaptionStyle(style);
  const resX = Math.max(2, Math.round(playResX));
  const resY = Math.max(2, Math.round(playResY));
  const fontSize = Math.max(12, Math.round(parsed.fontSize * (resY / PLAY_RES_Y)));
  const bold = parsed.fontWeight === 700 ? -1 : 0;
  const borderStyle = parsed.background === "box" ? 3 : 1;
  const backOpacity = parsed.background === "box" ? parsed.backgroundOpacity : 0;
  const primary = assColor(parsed.color, 1);
  const outline = assColor(parsed.outlineColor, 1);
  const back = assColor(parsed.backgroundColor, backOpacity);
  const posX = Math.round((parsed.x / 100) * resX);
  const posY = Math.round((parsed.y / 100) * resY);
  const fontName = parsed.fontFamily.replace(/,/g, " ");
  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${resX}`,
    `PlayResY: ${resY}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${fontName},${fontSize},${primary},&H000000FF,${outline},${back},${bold},0,0,0,100,100,0,0,${borderStyle},${parsed.outlineWidth},0,${assAlign(parsed.align)},80,80,40,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  for (const segment of segments) {
    const text = captionText(segment);
    if (!text) {
      continue;
    }
    const end = segment.end > segment.start ? segment.end : segment.start + 0.04;
    lines.push(
      `Dialogue: 0,${assTime(segment.start)},${assTime(end)},Default,,0,0,0,,{\\pos(${posX},${posY})}${assText(text)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
