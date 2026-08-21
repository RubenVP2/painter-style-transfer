"use client";

import type { Palette } from "@/lib/color";
import type { BackgroundMode, Scene, ScenePatch } from "@/lib/scene";
import { Section } from "./Section";
import { Segmented } from "./Segmented";
import { Slider } from "./Slider";

const MODES: { value: BackgroundMode; label: string }[] = [
  { value: "blur", label: "Flou" },
  { value: "gradient", label: "Dégradé" },
  { value: "solid", label: "Uni" },
];

export function BackgroundControls({
  scene,
  patch,
  palette,
}: {
  scene: Scene;
  patch: ScenePatch;
  palette: Palette | null;
}) {
  const { background } = scene;

  return (
    <Section
      title="Fond"
      action={
        palette && background.mode === "gradient" ? (
          <button
            type="button"
            className="cursor-pointer text-xs font-semibold text-accent-soft hover:underline"
            onClick={() => patch("background", { gradient: palette.dominant })}
          >
            Depuis l&apos;image
          </button>
        ) : null
      }
    >
      <Segmented
        value={background.mode}
        options={MODES}
        onChange={(mode) => patch("background", { mode })}
      />

      {background.mode === "blur" ? (
        <>
          <Slider
            label="Intensité du flou"
            value={background.blur}
            min={0}
            max={200}
            onChange={(blur) => patch("background", { blur })}
          />
          <Slider
            label="Luminosité"
            value={background.brightness}
            min={0.25}
            max={1.4}
            step={0.01}
            format={(value) => `${Math.round(value * 100)} %`}
            onChange={(brightness) => patch("background", { brightness })}
          />
          <Slider
            label="Saturation"
            value={background.saturation}
            min={0}
            max={2.5}
            step={0.05}
            format={(value) => `${Math.round(value * 100)} %`}
            onChange={(saturation) => patch("background", { saturation })}
          />
        </>
      ) : null}

      {background.mode === "gradient" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label mb-2 block">Haut</span>
            <input
              type="color"
              value={background.gradient[0]}
              onChange={(event) =>
                patch("background", { gradient: [event.target.value, background.gradient[1]] })
              }
            />
          </label>
          <label className="block">
            <span className="field-label mb-2 block">Bas</span>
            <input
              type="color"
              value={background.gradient[1]}
              onChange={(event) =>
                patch("background", { gradient: [background.gradient[0], event.target.value] })
              }
            />
          </label>
        </div>
      ) : null}

      {background.mode === "solid" ? (
        <label className="block">
          <span className="field-label mb-2 block">Couleur</span>
          <input
            type="color"
            value={background.solid}
            onChange={(event) => patch("background", { solid: event.target.value })}
          />
        </label>
      ) : null}
    </Section>
  );
}
