# Wallpaper Mockup Studio

App web construite **autour** de ce dépôt : tu glisses une image générée avec l'un des
[prompts](../prompts), elle s'affiche dans un iPhone posé sur un fond flouté dérivé de cette même
image, et tu exportes un JPG prêt pour TikTok.

Inspirée de [wallpapermockup.com/app](https://wallpapermockup.com/app/), réduite aux features utiles
ici. Le contenu du dépôt (`README.md`, `prompts/`) n'est jamais modifié — cette app le lit seulement.

## Fonctionnalités

- **Drag & drop**, collage (`⌘V` / `Ctrl+V`) ou sélecteur de fichiers · PNG, JPG, WebP, AVIF
- **Fond flouté** dérivé du wallpaper (intensité, luminosité, saturation), ou dégradé extrait des
  couleurs dominantes de l'image, ou couleur unie
- **iPhone 16 Pro / iPhone 16**, quatre finitions de châssis, taille et ombre réglables
- **Écran verrouillé iOS** : heure, date, Dynamic Island, barre de statut (opérateur, réseau, wifi,
  batterie), boutons lampe/caméra, barre d'accueil. Couleur du texte automatique selon la luminosité
  du wallpaper.
- **Recadrage** : glisser pour repositionner, molette pour zoomer, double-clic pour réinitialiser
- **Zones sûres TikTok** (250px haut, 700px bas, 240px droite) en repère d'aperçu — jamais exportées
- **Export JPG** (défaut, qualité réglable) ou **PNG**, en 1080×1920 / 2160×3840, plus les formats
  4:5 et 1:1. Copie presse-papiers également disponible.

Tout se passe dans le navigateur : aucune image n'est envoyée à un serveur.

## Démarrer

Node **22 ou plus** (`.nvmrc`, `engines.node` dans `package.json`) — Next.js 16 exige `>=20.9.0` et
Tailwind 4 `>=20`.

```bash
cd web
nvm use          # facultatif, lit .nvmrc
npm install
npm run dev      # http://localhost:3000
```

`predev` / `prebuild` lancent `scripts/sync-prompts.mjs`, qui **copie** `../prompts/*.md` dans
`src/content/prompts/`. C'est une copie en lecture seule : les fichiers source ne sont jamais
touchés. Cette copie est **commitée**, pour qu'un build dont le contexte se limite à `web/` (Nixpacks,
Dokploy…) dispose quand même du contenu ; le script la rafraîchit dès que `../prompts` est visible, et
échoue si ni la source ni la copie n'existent — mieux vaut casser le build que déployer une page vide.
N'édite jamais `src/content/prompts/` à la main : modifie `../prompts`, puis relance un build.

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build de production et service |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Smoke tests Playwright |

## Docker

Le contexte de build est **la racine du dépôt**, pas `web/` : l'image a besoin de `web/` *et* de
`prompts/`.

```bash
cd web
docker compose up --build        # http://localhost:3000
```

Ou directement :

```bash
docker build -f web/Dockerfile -t wallpaper-mockup-studio .
docker run --rm -p 3000:3000 wallpaper-mockup-studio
```

Build multi-stage sur `node:22-alpine`, sortie Next.js `standalone`, exécution sous un utilisateur
non-root. Les exclusions de contexte vivent dans `web/Dockerfile.dockerignore` (BuildKit lit
`<chemin-du-Dockerfile>.dockerignore` en priorité), ce qui évite d'ajouter un `.dockerignore` à la
racine du dépôt.

## Déploiement (Dokploy, Nixpacks…)

Deux chemins possibles, tous les deux fonctionnels :

| Type de build | Réglages |
|---|---|
| **Dockerfile** (recommandé) | Contexte : racine du dépôt · Dockerfile : `web/Dockerfile` |
| **Nixpacks** | Base / build path : `web` |

En Nixpacks, la version de Node vient de `engines.node` (`>=22`) et de `.nvmrc` : sans elle le
builder retombe sur Node 18, que Next.js 16 refuse (`You are using Node.js 18.x. For Next.js,
Node.js version ">=20.9.0" is required.`). Si un builder ignore ces deux fichiers, force la variable
d'environnement `NIXPACKS_NODE_VERSION=22`.

Ce chemin ne voit pas `../prompts` : c'est la copie commitée dans `src/content/prompts/` qui alimente
la page `/prompts`. Le service écoute sur `$PORT` (3000 par défaut).

## Architecture

Le rendu passe par **une seule fonction**, `renderScene(ctx, scene, options)`
(`src/lib/render/index.ts`), qui dessine dans un canvas 2D. L'aperçu est ce canvas dimensionné au
conteneur × `devicePixelRatio` ; l'export est le même appel sur un canvas hors écran en 1080×1920.
Ce que tu vois est donc exactement ce que tu obtiens.

Pourquoi pas du DOM capturé par `html-to-image` : ces libs sérialisent le DOM dans un `foreignObject`
SVG, où `filter: blur()` et `backdrop-filter` sont rendus de façon incohérente — c'est-à-dire
précisément la feature centrale ici. `ctx.filter = "blur(…)"` est natif, et
`canvas.toBlob("image/jpeg", q)` donne le JPG sans dépendance.

```
src/lib/
  scene.ts       État de la scène + valeurs par défaut
  devices.ts     Géométrie des appareils, en points iOS
  color.ts       Palette dominante + luminance (décide du texte clair/sombre)
  image.ts       Décodage des fichiers déposés
  export.ts      Rendu hors écran → blob → téléchargement / presse-papiers
  prompts.ts     Lecture des prompts (build time)
  render/
    index.ts       renderScene — l'orchestrateur
    background.ts  Flou (avec overscan), dégradé, uni
    device.ts      Châssis, boutons latéraux, ombre
    lockscreen.ts  Horloge, date, statut, Dynamic Island, boutons, glyphes
    guides.ts      Repères de zones sûres TikTok
    primitives.ts  roundRect, drawCover, clip, dégradés
```

Les dimensions sont exprimées en **points iOS** et converties en pixels par un facteur unique, si
bien que les mêmes nombres pilotent l'aperçu et un export à n'importe quelle résolution.

### Polices

Inter est chargée par un `<link>` vers Google Fonts au runtime plutôt que via `next/font/google`,
pour que le build Docker n'ait jamais besoin d'accès réseau. La pile canvas commence par
`-apple-system` / `SF Pro Display` : sur macOS et iOS, l'horloge est rendue avec la vraie police du
système, celle qu'utilise l'écran verrouillé.

## Tests

```bash
npm run test:e2e
```

Les tests vérifient notamment que l'overlay de zones sûres apparaît dans l'aperçu **et disparaît de
l'export** : le JPG téléchargé est redécodé dans le navigateur puis échantillonné.

Si l'environnement fournit un Chromium plus ancien que la version attendue par Playwright, pointe le
runner dessus au lieu d'en télécharger un :

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e
```
