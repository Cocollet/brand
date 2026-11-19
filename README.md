# Charte Cocollet

Source unique des couleurs, typos, logos et mascottes Cocollet. Les applis la **lient** ou en gardent une
**copie synchronisée** : on change une valeur ici, tout suit, sans repasser dans chaque appli.

Aperçu : https://cocollet.github.io/brand/

## Changer quelque chose

| Pour changer… | Éditer | |
| --- | --- | --- |
| une couleur, une taille, un rayon | `tokens.json` | même forme que le système de design « Cocollet » (claude.ai) |
| le dessin d'une mascotte | `src/mascots/<nom>.svg` | `{{amber}}`, `{{on-amber}}` = jetons de `tokens.json` |
| le logo | `src/logo/*.svg` | déclinaisons de couleur : `LOGOS` dans `build.mjs` |
| ajouter une mascotte | un nouveau `src/mascots/<nom>.svg` | les copies la récupèrent d'elles-mêmes (`manifest.json`) |

Puis pousser sur `main`. Le workflow `build` régénère les fichiers publiés et les commit ; GitHub Pages les sert
quelques minutes plus tard. **Ne jamais éditer les fichiers générés** (`tokens.css`, `logo/`, `mascots/`,
`manifest.json`, `index.html`) : le prochain build les écrase. En local : `node build.mjs` (Node 18+, sans dépendance).

Règles de génération : un `{{…}}` inconnu, une couleur invalide ou un jeton en double arrêtent le build ;
`tokens.css` ne contient jamais `>` ni `&` (Authentik les réécrit sur ses pages serveur).

## Fichiers publiés

| URL (`https://cocollet.github.io/brand/…`) | Contenu |
| --- | --- |
| `tokens.css` | variables `--cc-*` : couleurs (`--cc-amber`…), espacements, rayons, polices, `--cc-type-<style>` (raccourci `font`) |
| `mascots/<nom>.svg` | `ok`, `hello`, `done`, `working`, `slow`, `down`, `denied`, `lost` — couleurs en attributs ; classes `cc-face` et `cc-eyes` pour animer les yeux (« en cours ») |
| `logo/<nom>.svg` | `mark`, `mark-on-light`, `mark-cream`, `favicon`, `lockup-dark`, `lockup-light` |
| `manifest.json` | liste des fichiers publiés et leur empreinte |

Les polices (Lora 600, Inter) ne sont pas ici : Google Fonts, ou servies par l'appli quand sa CSP l'impose.

## Qui consomme quoi

| Appli | Comment | Délai après un push ici |
| --- | --- | --- |
| Login Authentik (`custom.css` du Brand) | `@import` de `tokens.css`, mascotte « accès refusé » par URL | ~10 min (cache de GitHub Pages) |
| `Cocollet/hello` (colonne du login) | `tokens.css` par lien, même origine | ~10 min |
| `Cocollet/status` | copie dans `public/brand/` (la page reste autonome si GitHub tombe) | nuit, ou tout de suite avec `BRAND_DISPATCH_TOKEN` |
| `Cocollet/anonymizer` (Caviardage) | copie dans `app/static/brand/` (sa CSP interdit tout lien externe), puis `update-ok.sh` | idem, puis mise à jour du LXC |

Dans les copies, le workflow `sync-brand` (nuit, à la demande, ou prévenu par ce dépôt) télécharge `manifest.json`
et les fichiers qu'il liste, et commit s'il y a une différence.

⚠️ Le login charge `tokens.css` : quiconque peut pousser ici peut changer l'apparence du login. Dépôt à protéger
comme le compte GitHub (2FA).
