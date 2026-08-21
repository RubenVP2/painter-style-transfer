"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ingestFiles,
  releaseItem,
  sceneForItem,
  type RejectedFile,
  type WallpaperItem,
} from "@/lib/batch";
import { DEFAULT_EXPORT, type ExportSettings } from "@/lib/export";
import { galleryAssetUrl } from "@/lib/gallery";
import { ACCEPT_ATTRIBUTE, imageFiles } from "@/lib/image";
import { DEFAULT_SCENE, type Scene } from "@/lib/scene";
import { BatchStrip } from "./BatchStrip";
import { ControlPanel } from "./controls/ControlPanel";
import { Dropzone } from "./Dropzone";
import { Stage } from "./Stage";

type Notice = { added: number; rejected: RejectedFile[] };

export function Studio() {
  const [scene, setScene] = useState<Scene>(DEFAULT_SCENE);
  const [items, setItems] = useState<WallpaperItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Mirrors the batch for the async ingest, which must count free slots against
  // the freshest list rather than the one captured when the drop started.
  const itemsRef = useRef<WallpaperItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  /**
   * The batch keeps its own crop per image, so a wallpaper patch is routed to
   * the selected item while everything else stays on the shared scene. Both
   * paths share the `ScenePatch` signature, which is why Stage and the control
   * panel need to know nothing about the batch.
   */
  const patch = useCallback(
    <K extends keyof Scene>(section: K, value: Partial<Scene[K]>) => {
      if (section === "wallpaper") {
        // Only the crop travels: the bitmap and the name belong to the item.
        const { offsetX, offsetY, zoom } = value as Partial<Scene["wallpaper"]>;
        setItems((current) =>
          current.map((item) =>
            item.id === selected?.id
              ? {
                  ...item,
                  offsetX: offsetX ?? item.offsetX,
                  offsetY: offsetY ?? item.offsetY,
                  zoom: zoom ?? item.zoom,
                }
              : item,
          ),
        );
        return;
      }
      setScene((current) => ({ ...current, [section]: { ...current[section], ...value } }));
    },
    [selected?.id],
  );

  /**
   * The single entry point for every source of files — picker, drop, paste,
   * gallery deep link. Whatever comes in, the result is a receipt: each file is
   * either in the batch or named in `rejected` with the reason it was refused.
   * `alreadyRejected` carries the non-images the caller filtered out, so they
   * are reported too instead of vanishing silently.
   */
  const acceptFiles = useCallback(async (files: File[], alreadyRejected: RejectedFile[] = []) => {
    if (files.length === 0) {
      setNotice({ added: 0, rejected: alreadyRejected });
      return;
    }

    setNotice(null);
    setImporting({ done: 0, total: files.length });
    try {
      // The ref, not the state, is what the ingest counts against: two drops in
      // flight would otherwise both see the same free slots.
      const result = await ingestFiles(files, itemsRef.current, (done, total) =>
        setImporting({ done, total }),
      );

      if (result.accepted.length > 0) {
        itemsRef.current = [...itemsRef.current, ...result.accepted];
        setItems(itemsRef.current);
        setSelectedId((currentId) => currentId ?? result.accepted[0].id);
      }
      setNotice({ added: result.accepted.length, rejected: [...alreadyRejected, ...result.rejected] });
    } finally {
      setImporting(null);
    }
  }, []);

  /** Splits a raw drop/paste/pick payload into images and things that are not. */
  const acceptDropped = useCallback(
    (files: FileList | File[] | null) => {
      const all = Array.from(files ?? []);
      if (all.length === 0) return;
      const images = imageFiles(all);
      const rejected = all
        .filter((file) => !images.includes(file))
        .map((file) => ({ name: file.name, reason: "ce fichier n'est pas une image" }));
      void acceptFiles(images, rejected);
    },
    [acceptFiles],
  );

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
        if (!cancelled) await acceptFiles([new File([blob], file, { type: blob.type })]);
      } catch {
        if (!cancelled) {
          setNotice({
            added: 0,
            rejected: [{ name: file, reason: "wallpaper de la galerie introuvable" }],
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acceptFiles]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const removeItem = useCallback((id: string) => {
    const target = itemsRef.current.find((item) => item.id === id);
    if (target) releaseItem(target);
    itemsRef.current = itemsRef.current.filter((item) => item.id !== id);
    setItems(itemsRef.current);
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const reset = useCallback(() => {
    itemsRef.current.forEach(releaseItem);
    itemsRef.current = [];
    setItems([]);
    setSelectedId(null);
    setScene(DEFAULT_SCENE);
    setNotice(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const composed = useMemo(() => sceneForItem(scene, selected), [scene, selected]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:h-[calc(100vh-3.5rem)] lg:flex-row">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        data-testid="wallpaper-input"
        onChange={(event) => {
          acceptDropped(event.target.files);
          // Lets the same file be picked again after being removed from the batch.
          event.target.value = "";
        }}
      />

      <div className="order-1 flex min-h-0 flex-col gap-3 lg:order-none lg:flex-1">
        <div className="panel relative h-[70svh] min-h-[420px] overflow-hidden p-4 lg:h-auto lg:min-h-0 lg:flex-1">
          <Stage scene={composed} patch={patch} palette={selected?.palette ?? null} onFiles={acceptDropped}>
            {selected ? null : <Dropzone onPick={openPicker} />}
          </Stage>

          {importing || notice ? (
            <div
              role="alert"
              className="absolute inset-x-4 bottom-4 rounded-xl border border-accent/40 bg-ink-900/95 px-4 py-2.5 text-center text-sm text-white backdrop-blur"
            >
              {importing ? (
                <p data-testid="import-progress">
                  Import {importing.done}/{importing.total}…
                </p>
              ) : (
                <ImportReport notice={notice!} onDismiss={() => setNotice(null)} />
              )}
            </div>
          ) : null}
        </div>

        {items.length > 0 ? (
          <BatchStrip
            items={items}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onRemove={removeItem}
            onAdd={openPicker}
          />
        ) : null}
      </div>

      <aside className="order-2 w-full shrink-0 lg:order-none lg:w-[340px] lg:overflow-y-auto lg:pr-1">
        <ControlPanel
          scene={composed}
          baseScene={scene}
          patch={patch}
          palette={selected?.palette ?? null}
          items={items}
          selected={selected}
          exportSettings={exportSettings}
          onExportSettingsChange={setExportSettings}
          onPickFile={openPicker}
          onReset={reset}
        />
      </aside>
    </div>
  );
}

/** Spells out what the app did with every file it was handed. */
function ImportReport({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const shown = notice.rejected.slice(0, 3);
  const hidden = notice.rejected.length - shown.length;

  return (
    <div className="flex items-start gap-3 text-left">
      <div className="min-w-0 flex-1">
        <p data-testid="import-report">
          {notice.added > 0
            ? `${notice.added} image${notice.added > 1 ? "s" : ""} ajoutée${notice.added > 1 ? "s" : ""}`
            : "Aucune image ajoutée"}
          {notice.rejected.length > 0 ? ` · ${notice.rejected.length} ignorée${notice.rejected.length > 1 ? "s" : ""}` : ""}
        </p>
        {shown.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-xs text-ink-400">
            {shown.map((file) => (
              <li key={file.name} className="truncate">
                <span className="text-white/80">{file.name}</span> — {file.reason}
              </li>
            ))}
            {hidden > 0 ? <li>et {hidden} autre{hidden > 1 ? "s" : ""}…</li> : null}
          </ul>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Masquer le rapport d'import"
        className="cursor-pointer rounded px-1 text-ink-400 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
