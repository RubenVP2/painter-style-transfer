"use client";

import { DEVICE_LIST, FRAME_FINISH_LIST, type DeviceId, type FrameFinishId } from "@/lib/devices";
import type { Scene, ScenePatch } from "@/lib/scene";
import { Section } from "./Section";
import { Segmented } from "./Segmented";
import { Slider } from "./Slider";
import { Toggle } from "./Toggle";

export function DeviceControls({ scene, patch }: { scene: Scene; patch: ScenePatch }) {
  const { device } = scene;

  return (
    <Section title="Appareil">
      <Segmented<DeviceId>
        label="Modèle"
        value={device.model}
        options={DEVICE_LIST.map((spec) => ({ value: spec.id, label: spec.label }))}
        onChange={(model) => patch("device", { model })}
      />

      <div>
        <span className="field-label mb-2 block">Finition</span>
        <div className="flex gap-2">
          {FRAME_FINISH_LIST.map((finish) => {
            const active = finish.id === device.finish;
            return (
              <button
                key={finish.id}
                type="button"
                title={finish.label}
                aria-label={finish.label}
                aria-pressed={active}
                onClick={() => patch("device", { finish: finish.id as FrameFinishId })}
                className={`h-8 w-8 cursor-pointer rounded-full transition ${
                  active ? "ring-2 ring-white ring-offset-2 ring-offset-ink-900" : "ring-1 ring-white/15"
                }`}
                style={{
                  background: `linear-gradient(135deg, ${finish.stops[1]}, ${finish.stops[2]} 55%, ${finish.stops[3]})`,
                }}
              />
            );
          })}
        </div>
      </div>

      <Slider
        label="Taille"
        value={device.scale}
        min={0.4}
        max={0.95}
        step={0.01}
        format={(value) => `${Math.round(value * 100)} %`}
        onChange={(scale) => patch("device", { scale })}
      />
      <Slider
        label="Ombre portée"
        value={device.shadow}
        min={0}
        max={1}
        step={0.01}
        format={(value) => `${Math.round(value * 100)} %`}
        onChange={(shadow) => patch("device", { shadow })}
      />
      <Toggle
        label="Afficher le châssis"
        checked={device.showFrame}
        onChange={(showFrame) => patch("device", { showFrame })}
      />
    </Section>
  );
}
