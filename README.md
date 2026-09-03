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

Ce fichier publie les ports sur l'hôte, ce qui est pratique en local et **inutilisable sur
Dokploy** — le déploiement se fait avec `docker-compose.dokploy.yml`, voir
[Déploiement (Dokploy)](#-déploiement-dokploy).

Le **navigateur n'appelle que le studio** : le panneau parallaxe tape `/api/parallax/*` sur
l'origine du studio, qui relaie côté serveur vers le parallaxe par le réseau interne. Le parallaxe
reste donc privé — pas de domaine public à lui, pas de CORS.

Le parallaxe expose trois routes, toutes relayées par le studio : `/health` (sonde), `/render`
(image → vidéo MP4, l'étape lente qui encode avec ffmpeg) et `/depth` (image → carte de profondeur
PNG, l'estimation seule, rapide).

### 👀 Aperçu live

Le bouton **Aperçu live** du panneau parallaxe prévisualise l'effet **en temps réel dans le
navigateur**, sans générer la vidéo : le studio récupère une fois la carte de profondeur via
`/depth`, puis anime un displacement WebGL avec exactement la même math de caméra que le service
(`parallax/service.py`). On règle animation / intensité / durée / profondeur inversée et on voit le
résultat bouger instantanément ; on ne lance `/render` (le rendu MP4) qu'une fois le réglage validé.
L'aperçu est une **approximation temps réel** du rendu (displacement en une passe, non ray-marché) :
la trajectoire, la séparation de profondeur et l'inversion sont fidèles, le pixel exact reste
l'affaire de la vidéo finale.

Les réglages passent par des variables d'environnement (voir `.env.example`, à copier en `.env`) :

| Variable | Défaut | Rôle |
|---|---|---|
| `PARALLAX_INTERNAL_URL` | `http://parallax:8100` | URL du parallaxe **telle que le studio la joint côté serveur** (réseau interne) |
| `STUDIO_PORT` / `PARALLAX_PORT` | `3000` / `8100` | Ports publiés sur l'hôte (le `8100` n'y sert qu'au debug direct) |

## 🚀 Déploiement (Dokploy)

Le dépôt porte **deux** compose. Mêmes deux services, mêmes images ; ce qui change tient à la
façon dont on les joint.

| Fichier | Usage | Ports |
|---|---|---|
| `docker-compose.yml` | local | publiés sur l'hôte (`3000` ; `8100` pour le debug) |
| `docker-compose.dokploy.yml` | Dokploy | **aucun** — Traefik route par `dokploy-network` |

Côté Dokploy, créer un service de type **Compose**, pointé sur `docker-compose.dokploy.yml`, et
**ne pas** limiter le chemin de build à `web/` : un build limité à `web/` ne voit ni `prompts/` ni
`parallax/`, c'est exactement ce que le compose de la racine règle.

### Pourquoi un fichier séparé : le conflit de ports

Déployer le `docker-compose.yml` local sur Dokploy échoue au démarrage du conteneur :

```
Bind for 0.0.0.0:3000 failed: port is already allocated
Error response from daemon: failed to set up container networking
```

Dokploy fait tourner **son propre Traefik**, qui détient déjà les ports 80/443 de la VPS, et son
interface d'administration écoute sur le **3000**. Un service qui demande `ports: - "3000:3000"`
réclame donc un port que le démon Docker a déjà attribué. Le même conflit attend le `8100` dès
qu'un second projet le publie.

Publier un port n'apporte de toute façon rien ici : Traefik joint les conteneurs **par le réseau
Docker `dokploy-network`**, pas par l'hôte. `docker-compose.dokploy.yml` n'a donc que des `expose:`
— le port d'écoute est documenté, pas réservé sur la machine — et rattache les deux services à ce
réseau (`external: true`). Rien à décaler, et `docker compose up` reste inchangé en local.

### Domaines et variables

Le **navigateur n'appelle que le studio** : le panneau parallaxe tape `/api/parallax/*` sur
l'origine du studio, qui relaie ces requêtes vers le parallaxe **côté serveur**, par le réseau
interne. Un seul domaine à créer (onglet **Domains**), pour le studio :

| Service | Port conteneur | Exemple |
|---|---|---|
| `studio` | `3000` | `https://studio.exemple.com` |
| `parallax` | `8100` | *aucun domaine — privé, joint par le réseau interne* |

Rien d'obligatoire dans l'onglet **Environment** : `PARALLAX_INTERNAL_URL` a pour défaut le nom de
service compose du parallaxe. Ne le poser que pour pointer ailleurs :

```
PARALLAX_INTERNAL_URL=http://parallax:8100   # défaut
```

✅ C'est une variable de **runtime** : plus aucun `NEXT_PUBLIC_*` figé dans le bundle client, donc
la changer n'impose plus de reconstruire le studio — un redémarrage suffit. Et comme le parallaxe
n'est plus joint depuis le navigateur, il n'a **ni domaine public ni CORS** à configurer.

Dernière différence, volontaire : le compose Dokploy ne fait pas attendre le studio après la santé
du parallaxe. En production, un OOM du parallaxe (torch est gourmand) ne doit pas emporter tout le
site — le panneau affiche déjà un repli quand `/api/parallax/health` ne répond pas.

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
