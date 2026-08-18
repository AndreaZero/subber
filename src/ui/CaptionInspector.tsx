import { useEffect, useMemo, useState } from "react";
import {
  CAPTION_FONTS,
  captionCenterH,
  captionCenterV,
  captionDefaultPos,
  type CaptionStyle,
} from "../lib/captions";
import type { FontItem } from "../lib/files";
import type { Msg } from "../lib/i18n";
import { inspectFont, listFonts, pickFontFile } from "../lib/native";
import { isStockFontPath } from "../lib/media";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";

type Tr = (key: Msg, vars?: Record<string, string | number>) => string;

type Props = {
  style: CaptionStyle;
  locked?: boolean;
  tr: Tr;
  onChange: (style: CaptionStyle) => void;
};

export function CaptionInspector({ style, locked, tr, onChange }: Props) {
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

  return (
    <section className="caption-inspector">
      <header className="studio-pane-head">
        <h2>{tr("captionStyleTitle")}</h2>
      </header>
      <div className="caption-form">
        <div className="caption-field">
          <span>{tr("captionFont")}</span>
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
          <Button variant="ghost" disabled={locked} onClick={() => void loadCustomFont()}>
            {tr("captionFontFile")}
          </Button>
          {style.fontFile ? (
            <small className="caption-font-file">{style.fontFile.replace(/^.*[\\/]/, "")}</small>
          ) : null}
          {fontError ? <small className="caption-font-error">{fontError}</small> : null}
        </div>
        <label className="caption-field">
          <span>
            {tr("captionSize")} · {style.fontSize}
          </span>
          <input
            type="range"
            min={24}
            max={96}
            step={1}
            value={style.fontSize}
            disabled={locked}
            onChange={(event) => patch({ fontSize: Number(event.target.value) })}
          />
        </label>
        <label className="caption-check">
          <input
            type="checkbox"
            checked={style.fontWeight === 700}
            disabled={locked}
            onChange={(event) => patch({ fontWeight: event.target.checked ? 700 : 400 })}
          />
          <span>{tr("captionBold")}</span>
        </label>
        <label className="caption-field is-color">
          <span>{tr("captionColor")}</span>
          <input
            type="color"
            value={style.color}
            disabled={locked}
            onChange={(event) => patch({ color: event.target.value.toUpperCase() })}
          />
        </label>
        <label className="caption-field is-color">
          <span>{tr("captionOutline")}</span>
          <input
            type="color"
            value={style.outlineColor}
            disabled={locked}
            onChange={(event) => patch({ outlineColor: event.target.value.toUpperCase() })}
          />
        </label>
        <label className="caption-field">
          <span>
            {tr("captionOutlineWidth")} · {style.outlineWidth}
          </span>
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={style.outlineWidth}
            disabled={locked}
            onChange={(event) => patch({ outlineWidth: Number(event.target.value) })}
          />
        </label>
        <div className="caption-field">
          <span>{tr("captionBox")}</span>
          <SegmentedControl
            value={style.background}
            disabled={locked}
            options={[
              { id: "none", label: tr("captionBoxNone") },
              { id: "box", label: tr("captionBoxOn") },
            ]}
            onChange={(background) => patch({ background })}
          />
        </div>
        {style.background === "box" ? (
          <label className="caption-field is-color">
            <span>{tr("captionBoxColor")}</span>
            <input
              type="color"
              value={style.backgroundColor}
              disabled={locked}
              onChange={(event) => patch({ backgroundColor: event.target.value.toUpperCase() })}
            />
          </label>
        ) : null}
        <div className="caption-field">
          <span>{tr("captionAlign")}</span>
          <SegmentedControl
            value={style.align}
            disabled={locked}
            options={[
              { id: "left", label: "⟵" },
              { id: "center", label: "↔" },
              { id: "right", label: "⟶" },
            ]}
            onChange={(align) => patch({ align })}
          />
        </div>
        <div className="caption-snap-actions">
          <Button variant="ghost" disabled={locked} onClick={() => onChange(captionCenterH(style))}>
            {tr("captionCenterH")}
          </Button>
          <Button variant="ghost" disabled={locked} onClick={() => onChange(captionCenterV(style))}>
            {tr("captionCenterV")}
          </Button>
          <Button variant="ghost" disabled={locked} onClick={() => onChange(captionDefaultPos(style))}>
            {tr("captionDefaultPos")}
          </Button>
        </div>
      </div>
    </section>
  );
}
