import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
  onTime?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  extraActions?: PlayerMenuAction[];
};

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { videoPath, poster, tr, onTime, onPlay, onPause, extraActions },
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

  function applySize(width: number, height: number) {
    if (width > 0 && height > 0) {
      setRatio(width / height);
    }
  }

  function toggle() {
    const video = videoRef.current;
    if (!video || failed) {
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

  const ar = ratio && ratio > 0 ? ratio : 16 / 9;
  const portrait = !wide && ar < 0.95;

  return (
    <div
      ref={boxRef}
      className={`video-player ${wide ? "is-wide" : ""} ${portrait ? "is-portrait" : "is-landscape"}`}
      style={{ ["--video-ar" as string]: String(ar) }}
      onContextMenu={menu.onContextMenu}
    >
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
              setDuration(node.duration || 0);
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
            onLoad={(event) => applySize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
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
      <div className="video-bar">
        <IconButton label={playing ? tr("playerPause") : tr("playerPlay")} onClick={toggle} disabled={!src || failed}>
          {playing ? <IconPause /> : <IconPlay />}
        </IconButton>
        <div className="audio-meter">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.01)}
            step={0.05}
            value={Math.min(time, duration || time)}
            disabled={!src || failed}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (videoRef.current) {
                videoRef.current.currentTime = next;
              }
              setTime(next);
              onTime?.(next);
            }}
            aria-label={tr("playerSeek")}
          />
          <p>
            <time>{formatMediaDuration(time)}</time>
            <span>/</span>
            <time>{formatMediaDuration(duration)}</time>
          </p>
        </div>
        <IconButton
          label={muted ? tr("playerUnmute") : tr("playerMute")}
          active={muted}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <IconMute /> : <IconVolume />}
        </IconButton>
        <IconButton label={wide ? tr("exitFullscreen") : tr("fullscreen")} onClick={() => void toggleWide()}>
          {wide ? <IconFullscreenExit /> : <IconFullscreen />}
        </IconButton>
      </div>
      <Popover open={menu.point != null} x={menu.point?.x} y={menu.point?.y} onClose={menu.close}>
        <button
          type="button"
          disabled={!src || failed}
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
