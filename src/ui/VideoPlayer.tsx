import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { formatMediaDuration } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { mediaSrc } from "../lib/media";
import { IconButton } from "./IconButton";
import {
  IconFullscreen,
  IconFullscreenExit,
  IconMute,
  IconPause,
  IconPlay,
  IconSkipBack,
  IconSkipFwd,
  IconVolume,
} from "./icons";
import { Popover, useMenuPoint } from "./Popover";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

export type VideoPlayerHandle = {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
};

export type PlayerMenuAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type Props = {
  videoPath?: string;
  poster?: string;
  tr: Tr;
  children?: ReactNode;
  extraActions?: PlayerMenuAction[];
  fallbackReady?: boolean;
  onTime?: (time: number) => void;
  onDuration?: (duration: number) => void;
  onUnavailable?: (failed: boolean) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onFallbackToggle?: () => void;
};

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  {
    videoPath,
    poster,
    tr,
    children,
    extraActions,
    fallbackReady,
    onTime,
    onDuration,
    onUnavailable,
    onPlay,
    onPause,
    onSeek,
    onFallbackToggle,
  },
  ref,
) {
  const src = useMemo(() => mediaSrc(videoPath), [videoPath]);
  const posterSrc = useMemo(() => mediaSrc(poster), [poster]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [failed, setFailed] = useState(false);
  const [wide, setWide] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const menu = useMenuPoint();

  useImperativeHandle(ref, () => ({
    play: () => {
      void videoRef.current?.play();
    },
    pause: () => {
      videoRef.current?.pause();
    },
    seek: (next: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, next);
      }
    },
  }));

  useEffect(() => {
    setFailed(false);
    setPlaying(false);
    setTime(0);
    setRatio(null);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }, [src]);

  useEffect(() => {
    onUnavailable?.(failed);
  }, [failed, onUnavailable]);

  useEffect(() => {
    if (!posterSrc) {
      return;
    }
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setRatio((current) => current ?? image.naturalWidth / image.naturalHeight);
      }
    };
    image.src = posterSrc;
  }, [posterSrc, src]);

  useEffect(() => {
    function sync() {
      setWide(Boolean(document.fullscreenElement === boxRef.current));
    }
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = muted ? 0 : volume;
    }
  }, [muted, volume]);

  function applySize(width: number, height: number) {
    if (width > 0 && height > 0) {
      setRatio(width / height);
    }
  }

  function toggle() {
    if (failed) {
      onFallbackToggle?.();
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  async function toggleWide() {
    const box = boxRef.current;
    if (!box) {
      return;
    }
    try {
      if (document.fullscreenElement === box) {
        await document.exitFullscreen();
      } else {
        await box.requestFullscreen();
      }
    } catch {
      void videoRef.current?.requestFullscreen();
    }
  }

  function seekTo(next: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = next;
    }
    setTime(next);
    onTime?.(next);
    onSeek?.(next);
  }

  const ar = ratio && ratio > 0 ? ratio : 16 / 9;
  const canPlay = Boolean((src && !failed) || (failed && fallbackReady));

  return (
    <div
      ref={boxRef}
      className={`video-player ${wide ? "is-wide" : ""}`}
      style={{ ["--video-ar" as string]: String(ar) }}
      onContextMenu={menu.onContextMenu}
    >
      <div className="video-stack">
        <div className="video-screen" onDoubleClick={() => void toggleWide()}>
          {src && !failed ? (
            <video
              ref={videoRef}
              src={src}
              poster={posterSrc || undefined}
              preload="metadata"
              playsInline
              muted={muted}
              onClick={toggle}
              onPlay={() => {
                setPlaying(true);
                onPlay?.();
              }}
              onPause={() => {
                setPlaying(false);
                onPause?.();
              }}
              onLoadedMetadata={(event) => {
                const node = event.currentTarget;
                const next = node.duration || 0;
                setDuration(next);
                onDuration?.(next);
                applySize(node.videoWidth, node.videoHeight);
              }}
              onTimeUpdate={(event) => {
                const at = event.currentTarget.currentTime;
                setTime(at);
                onTime?.(at);
              }}
              onError={() => setFailed(true)}
            />
          ) : posterSrc ? (
            <img
              src={posterSrc}
              alt=""
              onLoad={(event) =>
                applySize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
              }
            />
          ) : (
            <div className="video-empty" />
          )}
          {failed ? <p className="video-fallback">{tr("videoUnavailable")}</p> : null}
          <button
            type="button"
            className="video-hit"
            onClick={toggle}
            onDoubleClick={() => void toggleWide()}
            aria-label={playing ? tr("playerPause") : tr("playerPlay")}
          >
            {playing ? null : (
              <span>
                <IconPlay />
              </span>
            )}
          </button>
        </div>
        <div className="player-controls">
          <div className="player-seek">
            <time>{formatMediaDuration(time)}</time>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.05}
              value={Math.min(time, duration || time)}
              disabled={!canPlay}
              onChange={(event) => seekTo(Number(event.target.value))}
              aria-label={tr("playerSeek")}
            />
            <time>{formatMediaDuration(duration)}</time>
          </div>
          <div className="player-actions">
            <div className="player-transport">
              <IconButton
                label={tr("playerBack")}
                onClick={() => seekTo(Math.max(0, time - 10))}
                disabled={!canPlay}
              >
                <IconSkipBack />
              </IconButton>
              <IconButton
                label={playing ? tr("playerPause") : tr("playerPlay")}
                onClick={toggle}
                disabled={!canPlay}
              >
                {playing ? <IconPause /> : <IconPlay />}
              </IconButton>
              <IconButton
                label={tr("playerFwd")}
                onClick={() => seekTo(duration > 0 ? Math.min(duration, time + 10) : time + 10)}
                disabled={!canPlay}
              >
                <IconSkipFwd />
              </IconButton>
            </div>
            <div className="player-end">
              <div className="player-vol">
                <IconButton
                  label={muted ? tr("playerUnmute") : tr("playerMute")}
                  active={muted}
                  onClick={() => setMuted((value) => !value)}
                >
                  {muted ? <IconMute /> : <IconVolume />}
                </IconButton>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setVolume(next);
                    setMuted(next === 0);
                  }}
                  aria-label={tr("playerVolume")}
                />
              </div>
              <IconButton label={wide ? tr("exitFullscreen") : tr("fullscreen")} onClick={() => void toggleWide()}>
                {wide ? <IconFullscreenExit /> : <IconFullscreen />}
              </IconButton>
            </div>
          </div>
        </div>
        {children}
      </div>
      <Popover open={menu.point != null} x={menu.point?.x} y={menu.point?.y} onClose={menu.close}>
        <button
          type="button"
          disabled={!canPlay}
          onClick={() => {
            toggle();
            menu.close();
          }}
        >
          {playing ? tr("playerPause") : tr("playerPlay")}
        </button>
        <button
          type="button"
          onClick={() => {
            setMuted((value) => !value);
            menu.close();
          }}
        >
          {muted ? tr("playerUnmute") : tr("playerMute")}
        </button>
        <button
          type="button"
          onClick={() => {
            void toggleWide();
            menu.close();
          }}
        >
          {wide ? tr("exitFullscreen") : tr("fullscreen")}
        </button>
        {extraActions?.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.danger ? "is-danger" : undefined}
            disabled={action.disabled}
            onClick={() => {
              action.onClick();
              menu.close();
            }}
          >
            {action.label}
          </button>
        ))}
      </Popover>
    </div>
  );
});
