#
# Build context is the REPOSITORY ROOT, not web/, because the prompts gallery
# reads ../prompts at build time:
#
#   docker build -f web/Dockerfile -t wallpaper-mockup-studio .
#
# docker-compose.yml at the repository root already sets that up.

# --- deps -------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci

# --- builder ----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Next inline les NEXT_PUBLIC_* dans le bundle client AU BUILD : l'URL du
# service parallaxe doit donc arriver ici, pas au runtime. docker-compose.yml
# (racine) la passe ; sans elle, le client retombe sur http://localhost:8100.
# La valeur par défaut est reprise ici plutôt que laissée vide : Next inline la
# variable telle quelle, et une chaîne vide ne déclencherait pas le `??` du
# client — elle donnerait une URL vide au lieu du repli local.
ARG NEXT_PUBLIC_PARALLAX_URL=http://localhost:8100
ENV NEXT_PUBLIC_PARALLAX_URL=${NEXT_PUBLIC_PARALLAX_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY web ./
# scripts/sync-prompts.mjs (run by `prebuild`) copies these into src/content.
COPY prompts /prompts
RUN npm run build

# --- runner -----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# `output: "standalone"` bundles the server and only the modules it actually uses.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
