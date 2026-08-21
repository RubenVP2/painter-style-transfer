"use client";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      {label ? <span className="field-label mb-2 block">{label}</span> : null}
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-1 rounded-xl border border-white/8 bg-black/25 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              title={option.hint}
              className={`cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-white text-ink-900" : "text-ink-400 hover:bg-white/8 hover:text-ink-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
