"use client";

/**
 * A pill row rather than the grid-based Segmented control: the painter list
 * grows with the gallery, so it has to wrap instead of splitting one row into
 * ever-narrower columns.
 */
export function PainterFilter({
  painters,
  value,
  total,
  onChange,
}: {
  painters: { promptSlug: string; painter: string; count: number }[];
  value: string | null;
  total: number;
  onChange: (promptSlug: string | null) => void;
}) {
  const options = [{ promptSlug: null, painter: "Tous", count: total }, ...painters];

  return (
    <div role="radiogroup" aria-label="Filtrer par peintre" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.promptSlug === value;
        return (
          <button
            key={option.promptSlug ?? "all"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.promptSlug)}
            className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "border-white/0 bg-white text-ink-900"
                : "border-white/10 bg-white/5 text-ink-400 hover:bg-white/10 hover:text-ink-200"
            }`}
          >
            {option.painter}
            <span className={`ml-1.5 ${active ? "text-ink-600" : "text-white/30"}`}>{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}
