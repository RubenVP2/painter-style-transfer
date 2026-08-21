/** Formats a Date the way the iOS lock screen does, in French. */
export function formatLockScreen(date: Date, use24h: boolean) {
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: !use24h,
  })
    .format(date)
    // fr-FR separates AM/PM with a narrow no-break space; iOS uses a plain one.
    .replace(/\u202f/g, " ")
    .trim();

  const raw = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  return { time, date: raw.charAt(0).toUpperCase() + raw.slice(1) };
}

/** File sizes the way a French file manager shows them: `4,2 Mo`. */
export function formatBytes(bytes: number) {
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0 }).format(value)} ${units[unit]}`;
}

/** `2026-08-21` → `21 août 2026`. */
export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${iso}T00:00:00`),
  );
}
