"use client";

import { formatLockScreen } from "@/lib/format";
import type { Scene, ScenePatch, TextTone } from "@/lib/scene";
import { Section } from "./Section";
import { Segmented } from "./Segmented";
import { Slider } from "./Slider";
import { TextField } from "./TextField";
import { Toggle } from "./Toggle";

const TONES: { value: TextTone; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Choisi selon la luminosité du wallpaper" },
  { value: "light", label: "Clair", hint: "Texte blanc" },
  { value: "dark", label: "Sombre", hint: "Texte noir" },
];

export function LockScreenControls({ scene, patch }: { scene: Scene; patch: ScenePatch }) {
  const { lockScreen } = scene;

  const applyNow = () => {
    const now = formatLockScreen(new Date(), true);
    patch("lockScreen", { time: now.time, date: now.date });
  };

  return (
    <Section
      title="Écran verrouillé"
      action={
        <Toggle
          label=""
          checked={lockScreen.enabled}
          onChange={(enabled) => patch("lockScreen", { enabled })}
        />
      }
    >
      <div className={lockScreen.enabled ? "space-y-3.5" : "space-y-3.5 opacity-45"}>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Heure"
            value={lockScreen.time}
            maxLength={8}
            onChange={(time) => patch("lockScreen", { time })}
          />
          <TextField
            label="Date"
            value={lockScreen.date}
            maxLength={32}
            onChange={(date) => patch("lockScreen", { date })}
          />
        </div>
        <button type="button" className="btn-ghost w-full py-2 text-xs" onClick={applyNow}>
          Utiliser l&apos;heure actuelle
        </button>

        <Segmented<TextTone>
          label="Couleur du texte"
          value={lockScreen.textTone}
          options={TONES}
          onChange={(textTone) => patch("lockScreen", { textTone })}
        />

        <TextField
          label="Opérateur"
          value={lockScreen.carrier}
          placeholder="Vide"
          maxLength={14}
          onChange={(carrier) => patch("lockScreen", { carrier })}
        />
        <Slider
          label="Batterie"
          value={lockScreen.battery}
          min={1}
          max={100}
          suffix=" %"
          onChange={(battery) => patch("lockScreen", { battery })}
        />

        <div className="space-y-2.5 border-t border-white/8 pt-3.5">
          <Toggle
            label="Barre de statut"
            checked={lockScreen.showStatusBar}
            onChange={(showStatusBar) => patch("lockScreen", { showStatusBar })}
          />
          <Toggle
            label="Dynamic Island"
            checked={lockScreen.showIsland}
            onChange={(showIsland) => patch("lockScreen", { showIsland })}
          />
          <Toggle
            label="Boutons lampe / caméra"
            checked={lockScreen.showBottomButtons}
            onChange={(showBottomButtons) => patch("lockScreen", { showBottomButtons })}
          />
          <Toggle
            label="Barre d'accueil"
            checked={lockScreen.showHomeIndicator}
            onChange={(showHomeIndicator) => patch("lockScreen", { showHomeIndicator })}
          />
          <Toggle
            label="Assombrissement iOS"
            checked={lockScreen.showScrim}
            onChange={(showScrim) => patch("lockScreen", { showScrim })}
          />
        </div>
      </div>
    </Section>
  );
}
