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
