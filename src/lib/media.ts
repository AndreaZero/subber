import { convertFileSrc } from "@tauri-apps/api/core";

const CAPTION_FONT_STYLE_ID = "video-sub-caption-font";

export function mediaSrc(path: string | undefined | null): string {
  if (!path) {
    return "";
  }
  if (
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    path.startsWith("http:") ||
    path.startsWith("https:") ||
    path.startsWith("asset:")
  ) {
    return path;
  }
  try {
    return convertFileSrc(path.replace(/\\/g, "/"));
  } catch {
    return path;
  }
}

export function isStockFontPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  if (lower.includes("/windows/fonts/")) {
    return true;
  }
  if (lower.includes("/system/library/fonts")) {
    return true;
  }
  return /^\/library\/fonts\//i.test(normalized);
}

export function applyCaptionFont(family: string, file?: string) {
  const existing = document.getElementById(CAPTION_FONT_STYLE_ID);
  if (!file) {
    existing?.remove();
    return;
  }
  const node =
    existing instanceof HTMLStyleElement
      ? existing
      : Object.assign(document.createElement("style"), { id: CAPTION_FONT_STYLE_ID });
  if (!existing) {
    document.head.appendChild(node);
  }
  const src = mediaSrc(file).replace(/\\/g, "/").replace(/"/g, '\\"');
  const name = family.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  node.textContent = `@font-face { font-family: "${name}"; src: url("${src}"); font-display: swap; }`;
}
