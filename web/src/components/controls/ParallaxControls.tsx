"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WallpaperItem } from "@/lib/batch";
import { downloadBlob } from "@/lib/export";
import {
  ANIMATIONS,
  checkParallaxHealth,
  PARALLAX_HEALTH_INTERVAL_MS,
  renderParallax,
  type ParallaxSettings,
} from "@/lib/parallax";
import { Section } from "./Section";
import { Segmented } from "./Segmented";
import { Slider } from "./Slider";
import { Toggle } from "./Toggle";

const FPS_OPTIONS = [24, 30, 60] as const;
const HEIGHT_OPTIONS = [720, 1080, 1440, 1920] as const;

export function ParallaxControls({
  items,
  settings,
  onSettingsChange,
  onOpenPreview,
}: {
  items: WallpaperItem[];
  settings: ParallaxSettings;
  onSettingsChange: (settings: ParallaxSettings) => void;
  /** Opens the live preview for the selected wallpaper. */
  onOpenPreview: () => void;
}) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Poll the service so the section degrades to a hint instead of a dead form.
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const ok = await checkParallaxHealth();
      if (!cancelled) setAvailable(ok);
    };
    void probe();
    const timer = window.setInterval(probe, PARALLAX_HEALTH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const generate = useCallback(async () => {
    if (items.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setStatus(null);
    setProgress(null);
    try {
      const bitmaps = items.map((item) => item.bitmap);
      const names = items.map((item) => item.name);
      const result = await renderParallax(bitmaps, names, settings, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      downloadBlob(result.blob, result.filename);
      setStatus(
        result.count > 1
          ? `${result.count} vidéos téléchargées (ZIP).`
          : "Vidéo parallaxe téléchargée.",
      );
    } catch (error) {
      setStatus(
        error instanceof DOMException && error.name === "AbortError"
          ? "Génération annulée."
          : error instanceof Error
            ? error.message
            : "La génération a échoué.",
      );
    } finally {
      abortRef.current = null;
      setProgress(null);
      setBusy(false);
    }
  }, [items, settings]);

  if (!available) {
    return (
      <Section title="Vidéo parallaxe">
        <p className="text-xs text-ink-400" data-testid="parallax-unavailable">
          Service parallaxe indisponible — lance le service parallax (docker compose up parallax)
        </p>
      </Section>
    );
  }

  const patch = <K extends keyof ParallaxSettings>(key: K, value: ParallaxSettings[K]) =>
    onSettingsChange({ ...settings, [key]: value });

  return (
    <Section title="Vidéo parallaxe">
      <Segmented
        label="Animation"
        value={settings.animation}
        options={ANIMATIONS.map(({ id, label }) => ({ value: id, label }))}
        onChange={(animation) => patch("animation", animation)}
      />
      <Slider
        label="Intensité"
        value={settings.intensity}
        min={0.1}
        max={1}
        step={0.05}
        format={(value) => value.toFixed(2)}
        onChange={(intensity) => patch("intensity", intensity)}
      />
      <Slider
        label="Durée"
        value={settings.time}
        min={2}
        max={20}
        step={1}
        suffix=" s"
        onChange={(time) => patch("time", time)}
      />
      <Segmented
        label="FPS"
        value={String(settings.fps) as "24" | "30" | "60"}
        options={FPS_OPTIONS.map((fps) => ({ value: String(fps), label: String(fps) }))}
        onChange={(value) => patch("fps", Number(value) as ParallaxSettings["fps"])}
      />
      <Segmented
        label="Résolution"
        value={String(settings.heightPx) as "720" | "1080" | "1440" | "1920"}
        options={HEIGHT_OPTIONS.map((height) => ({ value: String(height), label: `${height}p` }))}
        onChange={(value) => patch("heightPx", Number(value) as ParallaxSettings["heightPx"])}
      />
      <Toggle
        label="Profondeur inversée"
        checked={settings.invertDepth}
        onChange={(invertDepth) => patch("invertDepth", invertDepth)}
      />

      <button
        type="button"
        className="btn-ghost w-full"
        data-testid="parallax-preview-button"
        disabled={items.length === 0}
        onClick={onOpenPreview}
      >
        Aperçu live
      </button>
      <p className="text-xs text-ink-600">
        Prévisualise l&apos;effet en temps réel à partir de la profondeur, sans générer la vidéo.
      </p>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          className="btn-primary"
          data-testid="parallax-generate-button"
          disabled={items.length === 0 || busy}
          onClick={() => void generate()}
        >
          {busy
            ? progress
              ? `Préparation ${progress.done}/${progress.total}…`
              : "Génération…"
            : "Générer la vidéo"}
        </button>
        {busy ? (
          <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}>
            Annuler
          </button>
        ) : null}
      </div>

      {status ? (
        <p aria-live="polite" className="text-xs text-ink-400" data-testid="parallax-status">
          {status}
        </p>
      ) : null}
    </Section>
  );
}
