import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  containRect,
  hexToRgba,
  snapCaption,
  type CaptionStyle,
} from "../lib/captions";

type FrameBox = { x: number; y: number; w: number; h: number };

type Props = {
  text: string;
  style: CaptionStyle;
  editable?: boolean;
  onChange?: (style: CaptionStyle) => void;
};

function transformFor(align: CaptionStyle["align"]): string {
  if (align === "left") {
    return "translate(0, -100%)";
  }
  if (align === "right") {
    return "translate(-100%, -100%)";
  }
  return "translate(-50%, -100%)";
}

export function CaptionOverlay({ text, style, editable, onChange }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const grab = useRef({ dx: 0, dy: 0 });
  const [frame, setFrame] = useState<FrameBox>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [guides, setGuides] = useState<{ gx: number | null; gy: number | null }>({
    gx: null,
    gy: null,
  });

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) {
      return;
    }

    function measure() {
      const host = layerRef.current;
      if (!host) {
        return;
      }
      const video = host.parentElement?.querySelector("video");
      const image = host.parentElement?.querySelector("img");
      const media = video || image;
      const width = host.clientWidth;
      const height = host.clientHeight;
      let aspect = 16 / 9;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        aspect = video.videoWidth / video.videoHeight;
      } else if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
        aspect = image.naturalWidth / image.naturalHeight;
      }
      setFrame(containRect(width, height, aspect));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    const video = layer.parentElement?.querySelector("video");
    video?.addEventListener("loadedmetadata", measure);
    return () => {
      observer.disconnect();
      video?.removeEventListener("loadedmetadata", measure);
    };
  }, []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!editable || !onChange) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.getBoundingClientRect();
    const anchorX =
      style.align === "left" ? box.left : style.align === "right" ? box.right : (box.left + box.right) / 2;
    const anchorY = box.bottom;
    grab.current = { dx: event.clientX - anchorX, dy: event.clientY - anchorY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging || !onChange || !frameRef.current) {
      return;
    }
    const rect = frameRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const ax = event.clientX - grab.current.dx;
    const ay = event.clientY - grab.current.dy;
    const snapped = snapCaption(
      ((ax - rect.left) / rect.width) * 100,
      ((ay - rect.top) / rect.height) * 100,
      rect.width,
      rect.height,
    );
    setGuides({ gx: snapped.gx, gy: snapped.gy });
    onChange({ ...style, x: snapped.x, y: snapped.y });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    setGuides({ gx: null, gy: null });
  }

  const scale = frame.h > 0 ? frame.h / 1080 : 0.4;
  const fontSize = Math.max(10, style.fontSize * scale);
  const stroke = style.outlineWidth * scale;
  const show = Boolean(text);

  return (
    <div ref={layerRef} className="caption-layer">
      <div
        ref={frameRef}
        className="caption-frame"
        style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
      >
        {dragging ? (
          <div className="caption-grid" aria-hidden="true">
            <span className="is-v is-third" style={{ left: "33.333%" }} />
            <span className="is-v is-third" style={{ left: "66.667%" }} />
            <span className="is-h is-third" style={{ top: "33.333%" }} />
            <span className="is-h is-third" style={{ top: "66.667%" }} />
            <span className="is-v is-safe" style={{ left: "8%" }} />
            <span className="is-v is-safe" style={{ left: "92%" }} />
            <span className="is-h is-safe" style={{ top: "8%" }} />
            <span className="is-h is-safe" style={{ top: "92%" }} />
            <span className={`is-v is-center ${guides.gx === 50 ? "is-snap" : ""}`} style={{ left: "50%" }} />
            <span className={`is-h is-center ${guides.gy === 50 ? "is-snap" : ""}`} style={{ top: "50%" }} />
            {guides.gx != null && guides.gx !== 50 ? (
              <span className="is-v is-snap" style={{ left: `${guides.gx}%` }} />
            ) : null}
            {guides.gy != null && guides.gy !== 50 ? (
              <span className="is-h is-snap" style={{ top: `${guides.gy}%` }} />
            ) : null}
          </div>
        ) : null}
        {show ? (
          <div
            className={`caption-box ${editable ? "is-edit" : ""} ${dragging ? "is-drag" : ""}`}
            style={{
              left: `${style.x}%`,
              top: `${style.y}%`,
              transform: transformFor(style.align),
              fontFamily: `"${style.fontFamily}", sans-serif`,
              fontSize: `${fontSize}px`,
              fontWeight: style.fontWeight,
              color: style.color,
              textAlign: style.align,
              WebkitTextStroke: stroke > 0 ? `${stroke}px ${style.outlineColor}` : undefined,
              paintOrder: "stroke fill",
              background:
                style.background === "box"
                  ? hexToRgba(style.backgroundColor, style.backgroundOpacity)
                  : "transparent",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
