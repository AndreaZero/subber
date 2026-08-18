import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type MenuPoint = { x: number; y: number };

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  x?: number;
  y?: number;
  className?: string;
  exclude?: { current: Node | null };
  anchor?: { current: HTMLElement | null };
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

function startBox(anchor?: { current: HTMLElement | null }, x?: number, y?: number) {
  const trigger = anchor?.current;
  if (trigger) {
    const hit = trigger.getBoundingClientRect();
    return { left: hit.left, top: hit.bottom + 6, minWidth: Math.max(168, hit.width) };
  }
  return { left: x ?? 0, top: y ?? 0, minWidth: undefined as number | undefined };
}

export function Popover({ open, onClose, children, x, y, className = "", exclude, anchor }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: globalThis.MouseEvent) {
      const target = event.target as Node;
      if (ref.current?.contains(target) || exclude?.current?.contains(target) || anchor?.current?.contains(target)) {
        return;
      }
      onClose();
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
  }, [open, onClose, exclude, anchor]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const pad = 8;

    function place() {
      const node = ref.current;
      if (!node) {
        return;
      }
      const trigger = anchor?.current;
      let left = x ?? 0;
      let top = y ?? 0;
      if (trigger) {
        const hit = trigger.getBoundingClientRect();
        left = hit.left;
        top = hit.bottom + 6;
        node.style.minWidth = `${Math.max(168, Math.round(hit.width))}px`;
      }
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      if (left + width > window.innerWidth - pad) {
        left = trigger
          ? Math.max(pad, trigger.getBoundingClientRect().right - width)
          : Math.max(pad, window.innerWidth - width - pad);
      }
      if (top + height > window.innerHeight - pad) {
        top = Math.max(pad, hitTop(trigger, height, pad));
      }
      node.style.left = `${Math.max(pad, left)}px`;
      node.style.top = `${Math.max(pad, top)}px`;
    }

    place();
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, x, y, children, anchor]);

  if (!open) {
    return null;
  }

  const box = startBox(anchor, x, y);
  const node = (
    <div
      ref={ref}
      className={`ui-popover is-fixed ${className}`.trim()}
      role="menu"
      style={{ left: box.left, top: box.top, minWidth: box.minWidth }}
    >
      {children}
    </div>
  );

  return createPortal(node, document.body);
}

function hitTop(trigger: HTMLElement | null | undefined, menuHeight: number, pad: number): number {
  if (!trigger) {
    return window.innerHeight - menuHeight - pad;
  }
  const hit = trigger.getBoundingClientRect();
  const above = hit.top - menuHeight - 6;
  return above >= pad ? above : window.innerHeight - menuHeight - pad;
}
