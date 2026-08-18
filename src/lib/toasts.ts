export type ToastTone = "info" | "success" | "warning" | "error";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
};

let nextId = 1;

export function createToast(
  tone: ToastTone,
  title: string,
  detail?: string,
): ToastItem {
  nextId += 1;
  return { id: `t${nextId}`, tone, title, detail };
}
