import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { formatMediaDuration, type ScriptSegment } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { mediaSrc } from "../lib/media";
import { IconButton } from "./IconButton";
import { IconPause, IconPlay } from "./icons";
import { Popover, useMenuPoint } from "./Popover";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

export type AudioPlayerHandle = {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
};

type Props = {
  audioPath?: string;
  segments: ScriptSegment[];
  tr: Tr;
  clock?: number;
  onTime?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
};

const RATES = [0.75, 1, 1.25, 1.5];

export const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(function AudioPlayer(
  { audioPath, segments, tr, clock, onTime, onPlay, onPause, onSeek },
  ref,
) {
  const src = useMemo(() => mediaSrc(audioPath), [audioPath]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const menu = useMenuPoint();

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
      setTime(next);
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
    setTime(0);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = rate;
    }
  }, [rate]);

  const playhead = clock ?? time;
  const active = segments.findIndex((segment) => playhead >= segment.start && playhead < segment.end);

  useEffect(() => {
    if (active < 0) {
      return;
    }
    const row = listRef.current?.querySelector(`[data-lyric="${active}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  if (!audioPath || !src) {
    return null;
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }

  function seek(next: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, next);
    }
    setTime(next);
    onSeek?.(next);
  }

  const lyric = segments[active];

  return (
    <div className="audio-player" onContextMenu={menu.onContextMenu}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          onPlay?.();
        }}
        onPause={() => {
          setPlaying(false);
          onPause?.();
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => {
          const at = event.currentTarget.currentTime;
          setTime(at);
          onTime?.(at);
        }}
        onEnded={() => {
          setPlaying(false);
        }}
      />
      <div className="audio-chrome">
        <IconButton label={playing ? tr("playerPause") : tr("playerPlay")} onClick={toggle}>
          {playing ? <IconPause /> : <IconPlay />}
        </IconButton>
        <div className="audio-meter">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.01)}
            step={0.05}
            value={Math.min(playing ? time : playhead, duration || time)}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label={tr("playerSeek")}
          />
          <p>
            <time>{formatMediaDuration(playing ? time : playhead)}</time>
            <span>/</span>
            <time>{formatMediaDuration(duration)}</time>
            <span className="audio-label">{tr("listenWav")}</span>
          </p>
        </div>
        <div className="audio-rates" role="group" aria-label={tr("playerSpeed")}>
          {RATES.map((value) => (
            <button
              key={value}
              type="button"
              className={value === rate ? "is-on" : undefined}
              onClick={() => setRate(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
      {lyric ? <p className="audio-now">{lyric.translated || lyric.text}</p> : null}
      {segments.length > 0 ? (
        <ul ref={listRef} className="audio-lyrics">
          {segments.map((segment, index) => (
            <li key={`${segment.start}-${index}`}>
              <button
                type="button"
                data-lyric={index}
                className={index === active ? "is-now" : undefined}
                onClick={() => {
                  seek(segment.start + 0.02);
                  void audioRef.current?.play();
                }}
              >
                <time>{formatMediaDuration(segment.start)}</time>
                <span>{segment.text}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{tr("lyricsEmpty")}</p>
      )}
      <Popover open={menu.point != null} x={menu.point?.x} y={menu.point?.y} onClose={menu.close}>
        <button
          type="button"
          onClick={() => {
            toggle();
            menu.close();
          }}
        >
          {playing ? tr("playerPause") : tr("playerPlay")}
        </button>
        {RATES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setRate(value);
              menu.close();
            }}
          >
            {value}× {tr("playerSpeed")}
          </button>
        ))}
      </Popover>
    </div>
  );
});
