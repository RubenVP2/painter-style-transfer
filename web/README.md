# Wallpaper Mockup Studio

App web construite **autour** de ce dépôt : tu glisses une image générée avec l'un des
[prompts](../prompts), elle s'affiche dans un iPhone posé sur un fond flouté dérivé de cette même
image, et tu exportes un JPG prêt pour TikTok.

Inspirée de [wallpapermockup.com/app](https://wallpapermockup.com/app/), réduite aux features utiles
ici. Le contenu du dépôt (`README.md`, `prompts/`) n'est jamais modifié — cette app le lit seulement.

## Fonctionnalités

- **Drag & drop**, collage (`⌘V` / `Ctrl+V`) ou sélecteur de fichiers · PNG, JPG, WebP, AVIF
- **Traitement par lots** : une ou plusieurs images d'un coup, les mêmes réglages appliqués à tout
  le lot, et un **téléchargement groupé en ZIP**
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

- **Galerie publique** (`/galerie`) : une vitrine des wallpapers commités dans le dépôt, filtrable
  par peintre, avec téléchargement du fichier d'origine **octet pour octet**

## Traitement par lots

Dépose 1 à **24 images** en une fois (drag & drop, `⌘V`, ou le sélecteur — il est `multiple`). Le
bandeau sous l'aperçu est le lot : chaque vignette se sélectionne pour la régler, se retire d'un ✕.

**Rien n'est perdu en silence.** Chaque fichier reçu ressort d'un côté ou de l'autre : ajouté au
lot, ou nommé dans le rapport d'import avec sa raison — pas une image, HEIC non décodable en
navigateur, plus de 25 Mo, déjà dans le lot, ou au-delà des 24 images. Un fichier illisible
n'interrompt jamais l'import des autres.

| Réglage | Portée |
|---|---|
| Format, fond, appareil, écran verrouillé, export | **Tout le lot** |
| Recadrage (glisser / molette / double-clic) | **L'image sélectionnée** — il dépend de son cadrage |
| Dégradé de fond | Dérivé des couleurs de **chaque** image, jusqu'à ce qu'une couleur soit choisie à la main : elle vaut alors pour tout le lot |

Le bouton d'export devient « **Télécharger les N mockups (ZIP)** » dès la deuxième image : chaque
image est rendue à la résolution choisie, puis empaquetée dans une archive
`mockups-1080x1920-N.zip`. Les images sont rendues **une à une** (un canvas 2160×3840 et son blob
pèsent des dizaines de Mo — en garder 24 en vol est ce qui ferait tomber l'onglet), avec une
progression et un bouton Annuler. « Copier » reste sur l'image sélectionnée.

L'archive est écrite par `src/lib/zip.ts`, **sans dépendance** : méthode « stored », puisque des
JPG/PNG sont déjà compressés et que les redéflater coûterait du CPU pour une fraction de pourcent.
Même parti pris que `canvas.toBlob` plutôt que `html-to-image` : le format est simple, la lib ne
vaut pas son poids dans le bundle.

Le studio se passe entièrement dans le navigateur : aucune image déposée n'est envoyée à un serveur.
La galerie, elle, sert des fichiers commités — c'est la seule partie qui vit côté serveur.

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

## Galerie

`/galerie` est une page publique : le lien se partage, n'importe qui parcourt les wallpapers et
télécharge le fichier tel quel. C'est une vitrine partagée, pas un historique local — d'où un
stockage côté dépôt plutôt que dans le navigateur.

### Ajouter un wallpaper

1. Déposer le fichier dans `web/public/gallery/`, nommé
   **`<slug-du-prompt>--<titre-en-kebab>.<ext>`** — par exemple
   `van-gogh--terrasse-de-cafe.png`. Le préfixe doit correspondre à un fichier de `../prompts` :
   c'est lui qui relie le wallpaper à la fiche du peintre. Formats acceptés : PNG, JPEG, WebP.
2. `npm run gallery`
3. Commiter le master, la vignette générée et `src/content/gallery/manifest.json`.

Un titre que le kebab-case rend mal (accents, ponctuation) se corrige dans
`public/gallery/titles.json` : `{ "van-gogh--terrasse-de-cafe": "Terrasse de café" }`.

| Commande | Rôle |
|---|---|
| `npm run gallery` | Régénère ce qui a changé (vignettes WebP 540px, placeholders, manifeste) |
| `npm run gallery -- --check` | N'écrit rien, sort en erreur si le manifeste est périmé (CI) |
| `npm run gallery -- --force` | Reconstruit toutes les vignettes |

Le script s'appuie sur `sharp`, en **devDependency uniquement** : ses sorties étant commitées, il
n'est pas branché sur `prebuild` et un build de déploiement n'en a jamais besoin.

### Pourquoi ce stockage

Le master est servi **sans jamais retraverser un canvas** — « qualité maximale » veut dire les octets
d'origine, pas une conversion en PNG (ré-encoder une image déjà générée n'ajoute aucune qualité, ça
multiplie juste le poids). Le seul dérivé est la vignette d'affichage, plus un placeholder flouté de
~400 octets inline dans le manifeste. Stocker les images en base64 serait le pire des choix : +33 %
de poids, aucun cache HTTP, tout le contenu dans la charge utile de la page.

Les en-têtes `Cache-Control: …immutable` sur `/gallery/*` (voir `next.config.ts`) supposent qu'un nom
de fichier donné ne change jamais de contenu. Pour remplacer une image, la renommer.

### Quand migrer vers un stockage objet

Git ne déduplique pas les binaires et n'oublie jamais rien. Avec des wallpapers de 2 à 5 Mo :

| Volume | État |
|---|---|
| < 50 fichiers | confortable |
| 50 – 100 | clone et build qui traînent, image Docker lourde |
| > 150 | à migrer — le poids est dans l'historique, un `git rm` ne le récupère pas |

La bascule ne touche aucun composant : copier `public/gallery/` vers un bucket R2/S3, vider le
dossier du dépôt (le manifeste reste, c'est du texte) et poser
`NEXT_PUBLIC_GALLERY_BASE_URL=https://cdn.exemple.com/gallery`. `galleryAssetUrl()` et
`downloadWallpaper()` (`src/lib/gallery.ts`) absorbent seuls la différence, y compris le fait que
l'attribut `download` est ignoré en cross-origin — le téléchargement repasse alors par `fetch`.
Prévoir côté bucket `Content-Disposition: attachment` et l'en-tête CORS correspondant.

**Git LFS est un piège ici** : Nixpacks et certains builders Dokploy ne lancent pas `git lfs pull`,
et déploient en silence des fichiers pointeurs de 130 octets à la place des images.

> Les trois wallpapers actuellement commités sont des **exemples** générés par un dégradé, là pour
> que la page et les tests aient du contenu. Remplace-les par tes vraies images.

## Docker

Le contexte de build est **la racine du dépôt**, pas `web/` : l'image a besoin de `web/` *et* de
`prompts/`. Le `docker-compose.yml` de la racine démarre le studio **et** le service parallaxe :

```bash
cd ..
docker compose up --build        # studio :3000, parallaxe :8100
```

Ou le studio seul :

```bash
docker build -f web/Dockerfile -t wallpaper-mockup-studio .
docker run --rm -p 3000:3000 wallpaper-mockup-studio
```

Le navigateur n'appelle pas le parallaxe directement : le panneau vidéo tape `/api/parallax/*` sur
l'origine du studio, que des route handlers (`src/app/api/parallax/*`) relaient côté serveur vers le
parallaxe. L'adresse interne est une variable de **runtime**, `PARALLAX_INTERNAL_URL` (défaut
`http://localhost:8100` ; `http://parallax:8100` dans les compose) — plus aucun `NEXT_PUBLIC_*`
figé au build.

Build multi-stage sur `node:22-alpine`, sortie Next.js `standalone`, exécution sous un utilisateur
non-root. Les exclusions de contexte vivent dans `web/Dockerfile.dockerignore` (BuildKit lit
`<chemin-du-Dockerfile>.dockerignore` en priorité), ce qui évite d'ajouter un `.dockerignore` à la
racine du dépôt.

## Déploiement (Dokploy, Nixpacks…)

Trois chemins possibles, tous fonctionnels :

| Type de build | Réglages |
|---|---|
| **Compose** (recommandé) | Fichier : `docker-compose.yml` à la racine — déploie le studio *et* le parallaxe |
| **Dockerfile** | Contexte : racine du dépôt · Dockerfile : `web/Dockerfile` — studio seul |
| **Nixpacks** | Base / build path : `web` — studio seul |

Le type **Compose** existe précisément parce qu'un build limité à `web/` ne voit ni `../prompts` ni
`../parallax` : voir la section Déploiement du [README de la racine](../README.md).

En Nixpacks, la version de Node vient de `engines.node` (`>=22`) et de `.nvmrc` : sans elle le
builder retombe sur Node 18, que Next.js 16 refuse (`You are using Node.js 18.x. For Next.js,
Node.js version ">=20.9.0" is required.`). Si un builder ignore ces deux fichiers, force la variable
d'environnement `NIXPACKS_NODE_VERSION=22`.

Ce chemin ne voit pas `../prompts` : c'est la copie commitée dans `src/content/prompts/` qui alimente
la page `/prompts`. Le service écoute sur `$PORT` (3000 par défaut). Il ne déploie pas non plus le
service parallaxe — le panneau vidéo affichera son repli « service indisponible » tant que
`PARALLAX_INTERNAL_URL` ne pointe pas sur une instance joignable.

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
  batch.ts       Le lot : ingestion + rapport, projection des réglages sur une image
  devices.ts     Géométrie des appareils, en points iOS
  color.ts       Palette dominante + luminance (décide du texte clair/sombre)
  image.ts       Décodage des fichiers déposés
  export.ts      Rendu hors écran → blob → téléchargement / archive / presse-papiers
  zip.ts         Writer ZIP « stored », sans dépendance
  prompts.ts     Lecture des prompts (build time)
  gallery.ts     Manifeste de la galerie, URL des fichiers, téléchargement du master
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

`e2e/batch.spec.ts` couvre le lot de bout en bout : le ZIP téléchargé est ouvert côté Node
(`e2e/zip.ts`, lecteur d'archives « stored »), chaque entrée est redécodée dans le navigateur pour
vérifier qu'elle sort bien à la résolution demandée avec les réglages communs — et qu'un fichier
refusé est bien nommé dans le rapport d'import plutôt que disparu.

Côté galerie (`e2e/gallery.spec.ts`), le test qui compte compare le **SHA-256** du fichier téléchargé
à celui du master sur disque : c'est ce qui prouve la promesse « servi sans recompression ».

Si l'environnement fournit un Chromium plus ancien que la version attendue par Playwright, pointe le
runner dessus au lieu d'en télécharger un :

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e
```
