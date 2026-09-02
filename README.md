# 🎨 Painter Style Transfer Prompts

Prompts optimisés pour transformer l'image d'un personnage dans le style d'un grand peintre, tout en préservant son identité — sortie au format TikTok (9:16, 1080×1920).

## 📁 Structure

| Fichier | Peintre | Mouvement |
|---|---|---|
| `prompts/van-gogh.md` | Vincent van Gogh | Post-impressionnisme |
| `prompts/claude-monet.md` | Claude Monet | Impressionnisme |
| `prompts/pablo-picasso.md` | Pablo Picasso | Cubisme |
| `prompts/hokusai.md` | Katsushika Hokusai | Ukiyo-e (estampe japonaise) |
| `prompts/rembrandt.md` | Rembrandt | Baroque / clair-obscur |
| `prompts/salvador-dali.md` | Salvador Dalí | Surréalisme |

Deux services accompagnent ces prompts : [`web/`](web/) et [`parallax/`](parallax/).

## 🐳 Lancer la pile

Le dépôt contient deux services, décrits par le `docker-compose.yml` de la **racine** :

| Service | Dossier | Rôle | Port |
|---|---|---|---|
| `studio` | `web/` | Wallpaper Mockup Studio (Next.js) + galerie + fiches prompts | `3000` |
| `parallax` | `parallax/` | Microservice DepthFlow : image → vidéo parallaxe MP4 | `8100` |

```bash
docker compose up --build     # http://localhost:3000
```

Le compose vit à la racine parce qu'aucun des deux services ne se construit depuis `web/` seul :
l'image du studio a besoin de `web/` **et** de `prompts/`, celle du parallaxe de `parallax/`.

Les réglages passent par des variables d'environnement (voir `.env.example`, à copier en `.env`) :

| Variable | Défaut | Rôle |
|---|---|---|
| `PARALLAX_PUBLIC_URL` | `http://localhost:8100` | URL du parallaxe **telle que le navigateur la joint** |
| `STUDIO_PUBLIC_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Origines autorisées par le CORS du parallaxe |
| `STUDIO_PORT` / `PARALLAX_PORT` | `3000` / `8100` | Ports publiés sur l'hôte |

## 🚀 Déploiement (Dokploy)

Un build limité à `web/` ne voit ni `prompts/` ni `parallax/` : c'est exactement ce que le compose de
la racine règle. Côté Dokploy, créer un service de type **Compose**, pointé sur
`docker-compose.yml`, et **ne pas** limiter le chemin de build à `web/`.

Le studio et le parallaxe ne se parlent pas entre eux : c'est le **navigateur** qui appelle
`/health` et `/render`. Le réseau interne Docker ne suffit donc pas — les deux services ont besoin
de leur propre domaine, et il faut les déclarer l'un à l'autre :

```
PARALLAX_PUBLIC_URL=https://parallax.exemple.com
STUDIO_PUBLIC_ORIGINS=https://studio.exemple.com
```

Dokploy publie les services via son propre Traefik : si les ports `3000`/`8100` sont déjà pris sur
l'hôte, les déplacer avec `STUDIO_PORT` / `PARALLAX_PORT` plutôt que de retirer les `ports:` — c'est
aussi ce qui garde `docker compose up` utilisable en local.

⚠️ `PARALLAX_PUBLIC_URL` alimente un **build arg** (`NEXT_PUBLIC_PARALLAX_URL`) : Next fige les
`NEXT_PUBLIC_*` dans le bundle client au moment du build. La modifier impose un **rebuild** du
studio, pas un simple redémarrage.

`STUDIO_PUBLIC_ORIGINS` est lu au runtime par le parallaxe, un redémarrage suffit.

## 🧩 Anatomie des prompts

Chaque prompt suit la structure **Keep / Change / How / Constraints** :

- **FORMAT** : canvas vertical 9:16 (1080×1920), zones safe TikTok (250px haut, 700px bas, 240px droite) pour éviter l'overlay de l'interface
- **PRESERVE** : identité du personnage (visage, proportions, pose, expression, tenue) — ce qui ne doit pas changer
- **APPLY** : technique, palette, texture et ambiance propres au peintre — décrites par leurs caractéristiques, pas seulement le nom de l'artiste
- **CONSTRAINTS** : seul le rendu change (brushwork, couleur, texture) ; pas de texte, signature, watermark ni bordure

## 💡 Conseils d'utilisation

- **img2img** : denoising strength entre 0.3 et 0.5 pour que le style s'impose sans déformer le sujet
- **Itération** : modifier une variable à la fois (palette, puis intensité des brushstrokes) et logger prompts + seeds
- **Negative prompt** (si supporté) : `text, watermark, signature, distorted face, extra limbs`
- **Langue** : les prompts en anglais donnent de meilleurs résultats sur la plupart des modèles
- **Composition** : si la source n'est pas verticale, le prompt demande au modèle d'étendre le décor dans le style du peintre (outpainting) plutôt que de recadrer le personnage

## ⚠️ Notes par style

- **Picasso / Dalí** : ces styles réinterprètent la géométrie par nature — le bloc PRESERVE y est adapté pour garantir la *reconnaissabilité* du personnage plutôt que sa géométrie exacte
- **Hokusai** : style très graphique (aplats + contours), excellent rendu sur les personnages au design marqué
