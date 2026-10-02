export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const logLevel = (process.env.LOG_LEVEL ?? "").toLowerCase().trim();
  if (logLevel === "warn" || logLevel === "warning") {
    console.debug = () => {};
    console.log = () => {};
    console.info = () => {};
  } else if (logLevel === "error") {
    console.debug = () => {};
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
  }
}
