"use client";

import { useRef, useState } from "react";
import type { WallpaperItem } from "@/lib/batch";
import type { Palette } from "@/lib/color";
import {
  batchArchiveName,
  copySceneToClipboard,
  downloadBlob,
  exportDimensions,
  exportFilename,
  renderBatchArchive,
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
  baseScene,
  palette,
  items,
  settings,
  onSettingsChange,
}: {
  /** The selected image, ready to render — used by the single export and the copy. */
  scene: Scene;
  /** The shared settings, re-projected onto every image of the batch. */
  baseScene: Scene;
  palette: Palette | null;
  items: WallpaperItem[];
  settings: ExportSettings;
  onSettingsChange: (settings: ExportSettings) => void;
}) {
  const [busy, setBusy] = useState<null | "download" | "copy">(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { width, height } = exportDimensions(scene, settings.multiplier);
  const ready = Boolean(scene.wallpaper.bitmap);
  const batch = items.length > 1;

  const run = async (kind: "download" | "copy") => {
    setBusy(kind);
    setStatus(null);
    try {
      if (kind === "copy") {
        await copySceneToClipboard(scene, palette);
        setStatus("Copié dans le presse-papiers (PNG).");
      } else if (batch) {
        const controller = new AbortController();
        abortRef.current = controller;
        setProgress({ done: 0, total: items.length });
        const archive = await renderBatchArchive(items, baseScene, settings, {
          signal: controller.signal,
          onProgress: setProgress,
        });
        downloadBlob(archive.blob, batchArchiveName(archive.count, width, height));
        setStatus(`${archive.count} mockups ${width}×${height} téléchargés (ZIP).`);
      } else {
        const { blob } = await renderExportBlob(scene, settings, palette);
        downloadBlob(blob, exportFilename(scene, settings, width, height));
        setStatus(`Export ${width}×${height} téléchargé.`);
      }
    } catch (error) {
      setStatus(
        error instanceof DOMException && error.name === "AbortError"
          ? "Export annulé."
          : error instanceof Error
            ? error.message
            : "L'export a échoué.",
      );
    } finally {
      abortRef.current = null;
      setProgress(null);
      setBusy(null);
    }
  };

  const downloadLabel = () => {
    if (busy === "download") {
      return progress ? `Export ${progress.done}/${progress.total}…` : "Export…";
    }
    return batch ? `Télécharger les ${items.length} mockups (ZIP)` : "Télécharger";
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
        {batch ? ` · ${items.length} images dans une archive ZIP` : ""}
      </p>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          className="btn-primary"
          data-testid="download-button"
          disabled={!ready || busy !== null}
          onClick={() => run("download")}
        >
          {downloadLabel()}
        </button>
        {busy === "download" && batch ? (
          <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}>
            Annuler
          </button>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            disabled={!ready || busy !== null}
            onClick={() => run("copy")}
            title="Copie toujours en PNG : les navigateurs refusent le JPEG dans le presse-papiers."
          >
            {busy === "copy" ? "…" : "Copier"}
          </button>
        )}
      </div>

      {batch ? (
        <p className="text-xs text-ink-600">
          «&nbsp;Copier&nbsp;» ne prend que l&apos;image sélectionnée.
        </p>
      ) : null}

      {status ? (
        <p aria-live="polite" className="text-xs text-ink-400">
          {status}
        </p>
      ) : null}
    </Section>
  );
}
