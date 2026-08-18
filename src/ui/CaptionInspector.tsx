import { useEffect, useMemo, useState } from "react";
import {
  CAPTION_FONTS,
  captionCenterH,
  captionCenterV,
  captionDefaultPos,
  hexToRgba,
  type CaptionStyle,
} from "../lib/captions";
import type { FontItem } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { inspectFont, listFonts, pickFontFile } from "../lib/native";
import { isStockFontPath } from "../lib/media";
import { IconButton } from "./IconButton";
import { IconFolder, IconSnapH, IconSnapReset, IconSnapV } from "./icons";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  style: CaptionStyle;
  locked?: boolean;
  previewText?: string;
  tr: Tr;
  onChange: (style: CaptionStyle) => void;
};

function ColorSwatch({
  value,
  disabled,
  label,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`caption-swatch ${disabled ? "is-off" : ""}`} title={label}>
      <span style={{ background: value }} />
      <input
        type="color"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
    </label>
  );
}

export function CaptionInspector({ style, locked, previewText, tr, onChange }: Props) {
  const [fonts, setFonts] = useState<FontItem[]>([]);
  const [fontError, setFontError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void listFonts()
      .then((items) => {
        if (alive) {
          setFonts(items);
        }
      })
      .catch(() => {
        if (alive) {
          setFonts([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; label: string; preview: boolean }[] = [];
    function add(family: string) {
      const key = family.toLowerCase();
      if (!family || seen.has(key)) {
        return;
      }
      seen.add(key);
      list.push({ id: family, label: family, preview: true });
    }
    add(style.fontFamily);
    for (const item of fonts) {
      add(item.family);
    }
    for (const family of CAPTION_FONTS) {
      add(family);
    }
    return list;
  }, [fonts, style.fontFamily]);

  function patch(partial: Partial<CaptionStyle>) {
    onChange({ ...style, ...partial });
  }

  async function loadCustomFont() {
    setFontError(null);
    const path = await pickFontFile();
    if (!path) {
      return;
    }
    try {
      const item = await inspectFont(path);
      onChange({ ...style, fontFamily: item.family, fontFile: item.path });
    } catch (error) {
      setFontError(error instanceof Error ? error.message : tr("captionFontFail"));
    }
  }

  const previewStroke = Math.max(0.4, style.outlineWidth * 0.28);
  const sample = (previewText || "").trim() || tr("captionPreview");
  const transform =
    style.align === "left" ? "translate(0, -100%)" : style.align === "right" ? "translate(-100%, -100%)" : "translate(-50%, -100%)";

  return (
    <section className="caption-inspector">
      <header className="studio-pane-head">
        <h2>{tr("captionStyleTitle")}</h2>
      </header>
      <div className="caption-split">
        <div className="caption-stage" aria-hidden="true">
          <span
            className="caption-stage-sample"
            style={{
              left: `${style.x}%`,
              top: `${style.y}%`,
              transform,
              fontFamily: `"${style.fontFamily}", sans-serif`,
              fontSize: `${Math.max(13, Math.round(style.fontSize * 0.34))}px`,
              fontWeight: style.fontWeight,
              color: style.color,
              textAlign: style.align,
              WebkitTextStroke: style.outlineWidth > 0 ? `${previewStroke}px ${style.outlineColor}` : undefined,
              paintOrder: "stroke fill",
              padding: style.background === "box" ? "0.08em 0.34em" : 0,
              borderRadius: 4,
              background:
                style.background === "box" ? hexToRgba(style.backgroundColor, style.backgroundOpacity) : "transparent",
            }}
          >
            {sample}
          </span>
        </div>
        <div className="caption-form">
        <div className="caption-group">
          <header>{tr("captionGroupType")}</header>
          <div className="caption-row">
            <span>{tr("captionFont")}</span>
            <div className="caption-row-end">
              <Select
                searchable
                value={style.fontFamily}
                disabled={locked}
                label={tr("captionFont")}
                searchPlaceholder={tr("captionFontSearch")}
                emptyLabel={tr("captionFontEmpty")}
                options={options}
                onChange={(fontFamily) => {
                  const match = fonts.find((item) => item.family === fontFamily);
                  const file = match?.path && !isStockFontPath(match.path) ? match.path : undefined;
                  patch({ fontFamily, fontFile: file });
                }}
              />
              <IconButton label={tr("captionFontFile")} disabled={locked} onClick={() => void loadCustomFont()}>
                <IconFolder />
              </IconButton>
            </div>
            {style.fontFile ? (
              <small className="caption-font-file">{style.fontFile.replace(/^.*[\\/]/, "")}</small>
            ) : null}
            {fontError ? <small className="caption-font-error">{fontError}</small> : null}
          </div>
          <div className="caption-row">
            <span>{tr("captionSize")}</span>
            <div className="caption-row-end">
              <input
                type="range"
                min={24}
                max={96}
                step={1}
                value={style.fontSize}
                disabled={locked}
                onChange={(event) => patch({ fontSize: Number(event.target.value) })}
              />
              <b className="caption-value">{style.fontSize}</b>
            </div>
          </div>
          <div className="caption-row">
            <span>{tr("captionBold")}</span>
            <div className="caption-row-end">
              <SegmentedControl
                value={style.fontWeight === 700 ? "700" : "400"}
                disabled={locked}
                options={[
                  { id: "400", label: tr("captionRegular") },
                  { id: "700", label: tr("captionBold") },
                ]}
                onChange={(weight) => patch({ fontWeight: weight === "700" ? 700 : 400 })}
              />
            </div>
          </div>
        </div>
        <div className="caption-group">
          <header>{tr("captionGroupLook")}</header>
          <div className="caption-row">
            <span>{tr("captionColor")}</span>
            <div className="caption-row-end">
              <ColorSwatch
                value={style.color}
                disabled={locked}
                label={tr("captionColor")}
                onChange={(color) => patch({ color })}
              />
              <ColorSwatch
                value={style.outlineColor}
                disabled={locked}
                label={tr("captionOutline")}
                onChange={(outlineColor) => patch({ outlineColor })}
              />
              <input
                type="range"
                min={0}
                max={8}
                step={0.5}
                value={style.outlineWidth}
                disabled={locked}
                aria-label={tr("captionOutlineWidth")}
                onChange={(event) => patch({ outlineWidth: Number(event.target.value) })}
              />
              <b className="caption-value">{style.outlineWidth}</b>
            </div>
          </div>
          <div className="caption-row">
            <span>{tr("captionBox")}</span>
            <div className="caption-row-end">
              <SegmentedControl
                value={style.background}
                disabled={locked}
                options={[
                  { id: "none", label: tr("captionBoxNone") },
                  { id: "box", label: tr("captionBoxOn") },
                ]}
                onChange={(background) => patch({ background })}
              />
              {style.background === "box" ? (
                <ColorSwatch
                  value={style.backgroundColor}
                  disabled={locked}
                  label={tr("captionBoxColor")}
                  onChange={(backgroundColor) => patch({ backgroundColor })}
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className="caption-group">
          <header>{tr("captionGroupLayout")}</header>
          <div className="caption-row">
            <span>{tr("captionAlign")}</span>
            <div className="caption-row-end">
              <SegmentedControl
                value={style.align}
                disabled={locked}
                options={[
                  { id: "left", label: "L" },
                  { id: "center", label: "C" },
                  { id: "right", label: "R" },
                ]}
                onChange={(align) => patch({ align })}
              />
            </div>
          </div>
          <div className="caption-row">
            <span>{tr("captionDefaultPos")}</span>
            <div className="caption-snap-actions">
              <IconButton label={tr("captionCenterH")} disabled={locked} onClick={() => onChange(captionCenterH(style))}>
                <IconSnapH />
              </IconButton>
              <IconButton label={tr("captionCenterV")} disabled={locked} onClick={() => onChange(captionCenterV(style))}>
                <IconSnapV />
              </IconButton>
              <IconButton
                label={tr("captionDefaultPos")}
                disabled={locked}
                onClick={() => onChange(captionDefaultPos(style))}
              >
                <IconSnapReset />
              </IconButton>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
