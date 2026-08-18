import { convertFileSrc } from "@tauri-apps/api/core";

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
