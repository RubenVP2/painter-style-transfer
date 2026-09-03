"use client";

import type { WallpaperItem } from "@/lib/batch";
import type { Palette } from "@/lib/color";
import type { ExportSettings } from "@/lib/export";
import type { ParallaxSettings } from "@/lib/parallax";
import { CANVAS_PRESET_LIST, type CanvasPresetId, type Scene, type ScenePatch } from "@/lib/scene";
import { BackgroundControls } from "./BackgroundControls";
import { DeviceControls } from "./DeviceControls";
import { ExportControls } from "./ExportControls";
import { LockScreenControls } from "./LockScreenControls";
import { ParallaxControls } from "./ParallaxControls";
import { Section } from "./Section";
import { Segmented } from "./Segmented";
import { Slider } from "./Slider";
import { Toggle } from "./Toggle";

export function ControlPanel({
  scene,
  baseScene,
  patch,
  palette,
  items,
  selected,
  exportSettings,
  onExportSettingsChange,
  parallaxSettings,
  onParallaxSettingsChange,
  onOpenParallaxPreview,
  onPickFile,
  onReset,
}: {
  /** The selected image projected onto the shared settings — what the stage draws. */
  scene: Scene;
  /** The shared settings alone, which the batch export re-projects per image. */
  baseScene: Scene;
  patch: ScenePatch;
  palette: Palette | null;
  items: WallpaperItem[];
  selected: WallpaperItem | null;
  exportSettings: ExportSettings;
  onExportSettingsChange: (settings: ExportSettings) => void;
  parallaxSettings: ParallaxSettings;
  onParallaxSettingsChange: (settings: ParallaxSettings) => void;
  onOpenParallaxPreview: () => void;
  onPickFile: () => void;
  onReset: () => void;
}) {
  const hasImage = Boolean(scene.wallpaper.bitmap);
  const position = selected ? items.findIndex((item) => item.id === selected.id) + 1 : 0;

  return (
    <div className="space-y-3">
      <Section
        title="Wallpapers"
        action={
          hasImage ? (
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer text-xs font-semibold text-ink-400 hover:text-white"
            >
              Tout retirer
            </button>
          ) : null
        }
      >
        <button type="button" className="btn-ghost w-full" onClick={onPickFile}>
          {hasImage ? "Ajouter des images" : "Choisir des images"}
        </button>
        {hasImage ? (
          <>
            <p className="truncate text-xs text-ink-400" title={scene.wallpaper.name ?? undefined}>
              {items.length > 1 ? `${position}/${items.length} · ` : ""}
              {scene.wallpaper.name}
            </p>
            <Slider
              label="Zoom"
              value={scene.wallpaper.zoom}
              min={1}
              max={4}
              step={0.01}
              format={(value) => `${value.toFixed(2)}×`}
              onChange={(zoom) => patch("wallpaper", { zoom })}
            />
            <p className="text-xs text-ink-600">
              Glisse sur l&apos;aperçu pour recadrer, molette pour zoomer, double-clic pour
              réinitialiser. Le recadrage est propre à cette image&nbsp;; tous les autres réglages
              s&apos;appliquent au lot entier.
            </p>
          </>
        ) : null}
      </Section>

      <Section title="Cadre">
        <Segmented<CanvasPresetId>
          label="Format d'export"
          value={scene.canvas.preset}
          options={CANVAS_PRESET_LIST.map((preset) => ({
            value: preset.id,
            label: preset.label,
            hint: preset.hint,
          }))}
          onChange={(preset) => patch("canvas", { preset })}
        />
        <Toggle
          label="Zones sûres TikTok"
          checked={scene.guides.tiktokSafeZones}
          onChange={(tiktokSafeZones) => patch("guides", { tiktokSafeZones })}
        />
        <p className="text-xs text-ink-600">
          Repères d&apos;aperçu uniquement (250px haut, 700px bas, 240px droite) — jamais exportés.
        </p>
      </Section>

      <BackgroundControls scene={scene} patch={patch} palette={palette} />
      <DeviceControls scene={scene} patch={patch} />
      <LockScreenControls scene={scene} patch={patch} />
      <ParallaxControls
        items={items}
        settings={parallaxSettings}
        onSettingsChange={onParallaxSettingsChange}
        onOpenPreview={onOpenParallaxPreview}
      />
      <ExportControls
        scene={scene}
        baseScene={baseScene}
        palette={palette}
        items={items}
        settings={exportSettings}
        onSettingsChange={onExportSettingsChange}
      />
    </div>
  );
}
