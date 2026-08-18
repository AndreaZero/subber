import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { ScriptSegment } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { mediaSrc } from "../lib/media";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

export type WaveformTrackHandle = {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
};

type Props = {
  seed?: string;
  audioPath?: string;
  duration: number;
  time: number;
  segments?: ScriptSegment[];
  busy?: boolean;
  armed?: boolean;
  tr: Tr;
  onTime?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
};

function cssColor(node: HTMLElement, name: string, fallback: string): string {
  const value = getComputedStyle(node).getPropertyValue(name).trim();
  return value || fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
  if (full.length < 6) {
    return `rgba(103, 101, 204, ${alpha})`;
  }
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function barsFromSeed(seed: string, count: number): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i += 1) {
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    const roll = (hash >>> 8) % 100;
    const speech = roll > 18;
    const amp = speech ? 0.28 + ((hash >>> 16) % 72) / 100 : 0.08 + ((hash >>> 4) % 10) / 100;
    bars.push(Math.min(1, amp));
  }
  return bars;
}

function shapeWithSegments(bars: number[], duration: number, segments: ScriptSegment[]): number[] {
  if (!duration || segments.length === 0) {
    return bars;
  }
  return bars.map((amp, index) => {
    const at = ((index + 0.5) / bars.length) * duration;
    const spoken = segments.some((segment) => at >= segment.start && at < segment.end);
    return spoken ? Math.min(1, amp * 1.12 + 0.08) : amp * 0.35;
  });
}

export const WaveformTrack = forwardRef<WaveformTrackHandle, Props>(function WaveformTrack(
  { seed, audioPath, duration, time, segments = [], busy, armed, tr, onTime, onPlay, onPause, onSeek },
  ref,
) {
  const src = useMemo(() => mediaSrc(audioPath), [audioPath]);
  const key = seed || audioPath || "track";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLButtonElement | null>(null);
  const timeRef = useRef(time);
  const durationRef = useRef(duration);
  const keyRef = useRef(key);
  const segmentsRef = useRef(segments);
  timeRef.current = time;
  durationRef.current = duration;
  keyRef.current = key;
  segmentsRef.current = segments;
  const ready = Boolean(armed && audioPath && src);

  useImperativeHandle(ref, () => ({
    play: () => {
      void audioRef.current?.play();
    },
    pause: () => {
      audioRef.current?.pause();
    },
    seek: (next: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, next);
      }
    },
  }));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    audio.currentTime = 0;
  }, [src]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }

    function paint() {
      const node = canvasRef.current;
      const box = wrapRef.current;
      if (!node || !box) {
        return;
      }
      const width = Math.max(1, box.clientWidth);
      const height = Math.max(1, box.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (node.width !== Math.round(width * dpr) || node.height !== Math.round(height * dpr)) {
        node.width = Math.round(width * dpr);
        node.height = Math.round(height * dpr);
      }
      const ctx = node.getContext("2d");
      if (!ctx) {
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const count = Math.max(48, Math.floor(width / 3));
      const bars = shapeWithSegments(barsFromSeed(keyRef.current, count), durationRef.current, segmentsRef.current);
      const gap = 1;
      const barW = Math.max(1, (width - gap * (count - 1)) / count);
      const mid = height / 2;
      const total = durationRef.current;
      const progress = total > 0 ? Math.min(1, Math.max(0, timeRef.current / total)) : 0;

      const accent = cssColor(box, "--accent", "#6765cc");
      const playhead = cssColor(box, "--text-0", "#e5e3e3");
      ctx.fillStyle = hexToRgba(accent, 0.08);
      ctx.fillRect(0, 0, width * progress, height);

      for (let i = 0; i < count; i += 1) {
        const x = i * (barW + gap);
        const h = Math.max(2, bars[i] * (height - 8));
        const played = i / count <= progress;
        ctx.fillStyle = played ? hexToRgba(accent, 0.95) : hexToRgba(accent, 0.32);
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, mid - h / 2, barW, h, 1);
        } else {
          ctx.rect(x, mid - h / 2, barW, h);
        }
        ctx.fill();
      }

      if (total > 0) {
        ctx.fillStyle = playhead;
        ctx.fillRect(Math.round(width * progress), 0, 1, height);
      }
    }

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    const timer = window.setInterval(paint, 80);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [key]);

  function seekAt(clientX: number) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box || duration <= 0) {
      return;
    }
    const next = Math.min(duration, Math.max(0, ((clientX - box.left) / box.width) * duration));
    if (audioRef.current) {
      audioRef.current.currentTime = next;
    }
    onSeek?.(next);
  }

  return (
    <div className={`waveform-track ${busy ? "is-busy" : ""}`}>
      {ready ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => onPlay?.()}
          onPause={() => onPause?.()}
          onTimeUpdate={(event) => onTime?.(event.currentTarget.currentTime)}
          onEnded={() => onPause?.()}
        />
      ) : null}
      <button
        ref={wrapRef}
        type="button"
        className="waveform-canvas"
        aria-label={tr("audioTrack")}
        onClick={(event) => seekAt(event.clientX)}
      >
        <canvas ref={canvasRef} />
      </button>
    </div>
  );
});
