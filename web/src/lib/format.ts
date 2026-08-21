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
