import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { formatMediaDuration, type ScriptSegment } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { mediaSrc } from "../lib/media";
import { IconButton } from "./IconButton";
import { IconPause, IconPlay, IconSkipBack, IconSkipFwd } from "./icons";
import { WaveformTrack } from "./WaveformTrack";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

export type AudioCoverHandle = {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
};

type Props = {
  title?: string;
  audioPath?: string;
  poster?: string;
  duration: number;
  time: number;
  segments: ScriptSegment[];
  busy?: boolean;
  hint?: string;
  tr: Tr;
  onTime?: (time: number) => void;
  onPlay?: () => void;
  onSeek?: (time: number) => void;
};

function LyricLine({
  text,
  start,
  end,
  clock,
}: {
  text: string;
  start: number;
  end: number;
  clock: number;
}) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return null;
  }
  const t = (clock - start) / Math.max(0.05, end - start);
  const active = Math.min(words.length - 1, Math.max(0, Math.floor(t * words.length)));
  return (
    <p className="cover-lyrics">
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className={index === active ? "is-on" : index < active ? "is-past" : ""}>
          {word}
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

export const AudioCover = forwardRef<AudioCoverHandle, Props>(function AudioCover(
  { title, audioPath, poster, duration, time, segments, busy, hint, tr, onTime, onPlay, onSeek },
  ref,
) {
  const src = useMemo(() => mediaSrc(audioPath), [audioPath]);
  const posterSrc = useMemo(() => mediaSrc(poster), [poster]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const ready = Boolean(audioPath && src);
  const total = audioDuration || duration;
  const current = segments.find((segment) => time >= segment.start && time < segment.end);
  const line = current?.text || current?.translated || hint || (busy ? tr("coverWaiting") : tr("lyricsEmpty"));

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
    setPlaying(false);
  }, [src]);

  function nudge(delta: number) {
    const next = Math.max(0, total > 0 ? Math.min(total, time + delta) : time + delta);
    if (audioRef.current) {
      audioRef.current.currentTime = next;
    }
    onSeek?.(next);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !ready) {
      return;
    }
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }

  return (
    <section className={`audio-cover-player ${busy ? "is-busy" : ""} ${playing ? "is-live" : ""}`}>
      {ready ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => {
            setPlaying(true);
            onPlay?.();
          }}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => onTime?.(event.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}
      <button
        type="button"
        className="cover-stage"
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? tr("playerPause") : tr("playerPlay")}
      >
        {posterSrc ? <img src={posterSrc} alt="" /> : <span className="cover-fill" />}
        <div className="cover-veil">
          {current ? (
            <LyricLine text={line} start={current.start} end={current.end} clock={time} />
          ) : (
            <p className="cover-lyrics is-wait">{line}</p>
          )}
        </div>
      </button>
      <div className="player-controls">
        <WaveformTrack
          seed={audioPath || title || "audio"}
          duration={total}
          time={time}
          segments={segments}
          busy={busy}
          tr={tr}
          onSeek={onSeek}
        />
        <div className="player-actions">
          <div className="player-transport">
            <IconButton
              label={tr("playerBack")}
              onClick={() => nudge(-10)}
              disabled={!ready}
            >
              <IconSkipBack />
            </IconButton>
            <IconButton label={playing ? tr("playerPause") : tr("playerPlay")} onClick={toggle} disabled={!ready}>
              {playing ? <IconPause /> : <IconPlay />}
            </IconButton>
            <IconButton
              label={tr("playerFwd")}
              onClick={() => nudge(10)}
              disabled={!ready}
            >
              <IconSkipFwd />
            </IconButton>
          </div>
          <p className="player-times">
            <time>{formatMediaDuration(time)}</time>
            <span>/</span>
            <time>{formatMediaDuration(total)}</time>
          </p>
        </div>
      </div>
    </section>
  );
});
