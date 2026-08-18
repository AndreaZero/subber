import { useEffect, useMemo, useRef, useState } from "react";
import { activeCaption, captionText } from "../lib/captions";
import type { useStudio } from "../lib/useStudio";
import type { AudioCoverHandle } from "./AudioCover";
import { CaptionInspector } from "./CaptionInspector";
import { MonitorPanel } from "./MonitorPanel";
import { TranscriptEditor } from "./TranscriptEditor";
import type { VideoPlayerHandle } from "./VideoPlayer";

type Studio = ReturnType<typeof useStudio>;

type Props = {
  studio: Studio;
  pair: string;
};

export function StudioFloor({ studio, pair }: Props) {
  const { tr } = studio;
  const videoApi = useRef<VideoPlayerHandle>(null);
  const audioApi = useRef<AudioCoverHandle>(null);
  const [clock, setClock] = useState(0);
  const selected = studio.selected;

  useEffect(() => {
    setClock(0);
  }, [selected?.path]);

  function onClock(time: number) {
    setClock((prev) => (Math.abs(prev - time) < 0.08 ? prev : time));
  }

  function seekAll(time: number) {
    videoApi.current?.seek(time);
    audioApi.current?.seek(time);
    setClock(time);
  }

  const captionSample = useMemo(() => {
    if (!studio.script) {
      return "";
    }
    const segment = activeCaption(studio.script.segments, clock);
    return segment ? captionText(segment) : "";
  }, [clock, studio.script]);

  return (
    <div className={`studio-floor ${studio.working ? "is-busy" : ""} ${studio.productMode === "video" ? "is-video" : ""}`}>
      <MonitorPanel
        studio={studio}
        pair={pair}
        clock={clock}
        onClock={onClock}
        videoApi={videoApi}
        audioApi={audioApi}
        onSeek={seekAll}
      />
      <div className="studio-editor-col">
        <TranscriptEditor
          title={tr("editDockTitle")}
          script={studio.script}
          loading={studio.scriptLoading}
          working={Boolean(selected && studio.working && !studio.script)}
          workingLabel={selected?.message || tr("scriptWorking")}
          workingPercent={selected?.percent}
          editable={!studio.working && Boolean(studio.script)}
          saving={studio.scriptSaving}
          currentTime={clock}
          duration={selected?.durationSecs}
          empty={!selected}
          tr={tr}
          onSave={(segments) => void studio.saveEdits(segments)}
          onSeek={seekAll}
          onCopy={(text, title) => void studio.copyText(text, title)}
        />
        {studio.productMode === "video" ? (
          <CaptionInspector
            style={studio.captionStyle}
            locked={studio.working}
            previewText={captionSample}
            tr={tr}
            onChange={studio.setCaptionStyle}
          />
        ) : null}
      </div>
    </div>
  );
}
