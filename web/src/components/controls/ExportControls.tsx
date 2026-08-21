"use client";

import { useState } from "react";
import type { Palette } from "@/lib/color";
import {
  copySceneToClipboard,
  downloadBlob,
  exportDimensions,
  exportFilename,
  renderExportBlob,
  type ExportFormat,
  type ExportSettings,
} from "@/lib/export";
import type { Scene } from "@/lib/scene";
import { Section } from "./Section";
import { Segmented } from "./Segmented";
import { Slider } from "./Slider";

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "jpeg", label: "JPG", hint: "Recommandé pour TikTok" },
  { value: "png", label: "PNG", hint: "Sans perte, fichier plus lourd" },
];

export function ExportControls({
  scene,
  palette,
  settings,
  onSettingsChange,
}: {
  scene: Scene;
  palette: Palette | null;
  settings: ExportSettings;
  onSettingsChange: (settings: ExportSettings) => void;
}) {
  const [busy, setBusy] = useState<null | "download" | "copy">(null);
  const [status, setStatus] = useState<string | null>(null);

  const { width, height } = exportDimensions(scene, settings.multiplier);
  const ready = Boolean(scene.wallpaper.bitmap);

  const run = async (kind: "download" | "copy") => {
    setBusy(kind);
    setStatus(null);
    try {
      if (kind === "copy") {
        await copySceneToClipboard(scene, palette);
        setStatus("Copié dans le presse-papiers (PNG).");
      } else {
        const { blob } = await renderExportBlob(scene, settings, palette);
        downloadBlob(blob, exportFilename(scene, settings, width, height));
        setStatus(`Export ${width}×${height} téléchargé.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "L'export a échoué.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Export">
      <Segmented<ExportFormat>
        label="Format"
        value={settings.format}
        options={FORMATS}
        onChange={(format) => onSettingsChange({ ...settings, format })}
      />
      <Segmented<"1" | "2">
        label="Résolution"
        value={String(settings.multiplier) as "1" | "2"}
        options={[
          { value: "1", label: `${width / settings.multiplier}px` },
          { value: "2", label: `${(width / settings.multiplier) * 2}px` },
        ]}
        onChange={(value) =>
          onSettingsChange({ ...settings, multiplier: Number(value) as 1 | 2 })
        }
      />

      {settings.format === "jpeg" ? (
        <Slider
          label="Qualité JPG"
          value={settings.quality}
          min={0.5}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)} %`}
          onChange={(quality) => onSettingsChange({ ...settings, quality })}
        />
      ) : null}

      <p className="text-xs text-ink-400">
        Sortie&nbsp;: {width}×{height}px · {settings.format === "jpeg" ? "JPG" : "PNG"}
      </p>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={!ready || busy !== null}
          onClick={() => run("download")}
        >
          {busy === "download" ? "Export…" : "Télécharger"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!ready || busy !== null}
          onClick={() => run("copy")}
          title="Copie toujours en PNG : les navigateurs refusent le JPEG dans le presse-papiers."
        >
          {busy === "copy" ? "…" : "Copier"}
        </button>
      </div>

      {status ? (
        <p aria-live="polite" className="text-xs text-ink-400">
          {status}
        </p>
      ) : null}
    </Section>
  );
}
