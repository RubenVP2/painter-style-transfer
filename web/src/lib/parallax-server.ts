/**
 * Server-only helpers for proxying the Studio's /api/parallax/* routes to the
 * parallax microservice over the docker internal network.
 *
 * The browser never talks to parallax directly anymore, so this URL is a plain
 * *runtime* server env (NOT NEXT_PUBLIC): changing the parallax address needs
 * no studio rebuild. Inside docker it resolves to the compose service name
 * (`http://parallax:8100`); the localhost fallback covers `next dev` against a
 * parallax whose port is published on the host.
 */
export const PARALLAX_INTERNAL_URL =
  process.env.PARALLAX_INTERNAL_URL ?? "http://localhost:8100";
