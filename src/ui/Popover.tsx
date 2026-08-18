import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

export type MenuPoint = { x: number; y: number };

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  x?: number;
  y?: number;
};

export function menuPointFromEvent(event: { clientX: number; clientY: number }): MenuPoint {
  return { x: event.clientX, y: event.clientY };
}

export function menuPointFromElement(el: HTMLElement, width = 196): MenuPoint {
  const box = el.getBoundingClientRect();
  return { x: Math.max(8, box.right - width), y: box.bottom + 4 };
}

export function useMenuPoint() {
  const [point, setPoint] = useState<MenuPoint | null>(null);
  const onContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPoint({ x: event.clientX, y: event.clientY });
  }, []);
  const openAt = useCallback((next: MenuPoint) => setPoint(next), []);
  const close = useCallback(() => setPoint(null), []);
  return { point, onContextMenu, openAt, close };
}

export function Popover({ open, onClose, children, x, y }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fixed = x != null && y != null;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !fixed || !ref.current) {
      return;
    }
    const el = ref.current;
    const box = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + box.width > window.innerWidth - pad) {
      left = window.innerWidth - box.width - pad;
    }
    if (top + box.height > window.innerHeight - pad) {
      top = window.innerHeight - box.height - pad;
    }
    el.style.left = `${Math.max(pad, left)}px`;
    el.style.top = `${Math.max(pad, top)}px`;
  }, [open, fixed, x, y, children]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`ui-popover ${fixed ? "is-fixed" : ""}`}
      role="menu"
      style={fixed ? { left: x, top: y } : undefined}
    >
      {children}
    </div>
  );
}
