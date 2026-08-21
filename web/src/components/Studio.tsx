"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyseImage, type Palette } from "@/lib/color";
import { DEFAULT_EXPORT, type ExportSettings } from "@/lib/export";
import { galleryAssetUrl } from "@/lib/gallery";
import { ACCEPT_ATTRIBUTE, ImageLoadError, loadImageFile } from "@/lib/image";
import { DEFAULT_SCENE, type Scene } from "@/lib/scene";
import { ControlPanel } from "./controls/ControlPanel";
import { Dropzone } from "./Dropzone";
import { Stage } from "./Stage";

export function Studio() {
  const [scene, setScene] = useState<Scene>(DEFAULT_SCENE);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback(
    <K extends keyof Scene>(section: K, value: Partial<Scene[K]>) => {
      setScene((current) => ({ ...current, [section]: { ...current[section], ...value } }));
    },
    [],
  );

  const acceptFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const bitmap = await loadImageFile(file);
      const nextPalette = analyseImage(bitmap);
      setPalette(nextPalette);
      setScene((current) => ({
        ...current,
        wallpaper: { bitmap, name: file.name, offsetX: 0, offsetY: 0, zoom: 1 },
        background: nextPalette
          ? { ...current.background, gradient: nextPalette.dominant }
          : current.background,
      }));
    } catch (cause) {
      setError(
        cause instanceof ImageLoadError
          ? cause.message
          : "Impossible de charger cette image. Essaie un PNG ou un JPG.",
      );
    }
  }, []);

  /**
   * Deep link from the gallery: `/?w=<filename>` drops that wallpaper straight
   * into the studio.
   *
   * The filename travels in the URL rather than a slug so this never has to
   * import the manifest — the studio bundle stays free of it however large the
   * gallery grows. The pattern is what keeps an arbitrary URL out of fetch().
   */
  useEffect(() => {
    const file = new URLSearchParams(window.location.search).get("w");
    if (!file || !/^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpe?g|webp)$/.test(file)) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(galleryAssetUrl(file));
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (!cancelled) await acceptFile(new File([blob], file, { type: blob.type }));
      } catch {
        if (!cancelled) setError("Ce wallpaper de la galerie n'a pas pu être chargé.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acceptFile]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const reset = useCallback(() => {
    setScene(DEFAULT_SCENE);
    setPalette(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:h-[calc(100vh-3.5rem)] lg:flex-row">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        data-testid="wallpaper-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void acceptFile(file);
        }}
      />

      <div className="panel relative order-1 min-h-[420px] flex-1 overflow-hidden p-4 lg:order-none lg:min-h-0">
        <Stage scene={scene} patch={patch} palette={palette} onFile={(file) => void acceptFile(file)}>
          {scene.wallpaper.bitmap ? null : <Dropzone onPick={openPicker} />}
        </Stage>

        {error ? (
          <p
            role="alert"
            className="absolute inset-x-4 bottom-4 rounded-xl border border-accent/40 bg-accent/15 px-4 py-2.5 text-center text-sm text-white"
          >
            {error}
          </p>
        ) : null}
      </div>

      <aside className="order-2 w-full shrink-0 lg:order-none lg:w-[340px] lg:overflow-y-auto lg:pr-1">
        <ControlPanel
          scene={scene}
          patch={patch}
          palette={palette}
          exportSettings={exportSettings}
          onExportSettingsChange={setExportSettings}
          onPickFile={openPicker}
          onReset={reset}
        />
      </aside>
    </div>
  );
}
