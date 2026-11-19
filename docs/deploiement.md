# 🚀 Déploiement sur Dokploy

> Guide détaillé, sorti du README principal. Pour un lancement local, `docker compose up --build` suffit.

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

