"use client";

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${disabled ? "opacity-45" : ""}`}>
      <span className="mb-2 flex items-baseline justify-between">
        <span className="field-label">{label}</span>
        <span className="text-xs font-medium tabular-nums text-ink-200">
          {format ? format(value) : `${Math.round(value)}${suffix}`}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
