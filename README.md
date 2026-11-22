# Charte Cocollet

Source unique des couleurs, typos, logos et mascottes Cocollet. Les applis la **lient** ou en gardent une
**copie synchronisée** : on change une valeur ici, tout suit, sans repasser dans chaque appli.

Aperçu : https://cocollet.github.io/brand/

## Changer quelque chose

| Pour changer… | Éditer | |
| --- | --- | --- |
| une couleur, une taille, un rayon | `tokens.json` | même forme que le système de design « Cocollet » (claude.ai) ; une couleur a une valeur par thème |
| le dessin d'une mascotte | `src/mascots/<nom>.svg` | `{{amber}}`, `{{on-amber}}` = jetons de `tokens.json` |
| le logo | `src/logo/*.svg` | déclinaisons de couleur : `LOGOS` dans `build.mjs` |
| ajouter une mascotte | un nouveau `src/mascots/<nom>.svg` | les copies la récupèrent d'elles-mêmes (`manifest.json`) |
| l'habillage d'une appli tierce (Immich) | `src/apps/<appli>.css` | `{{light:bg}}`, `{{rgb:dark:amber}}` = un jeton dans un thème, en hexadécimal ou en triplet RVB |

Puis pousser sur `main`. Le workflow `build` régénère les fichiers publiés et les commit ; GitHub Pages les sert
quelques minutes plus tard. **Ne jamais éditer les fichiers générés** (`tokens.css`, `logo/`, `mascots/`, `apps/`,
`manifest.json`, `index.html`) : le prochain build les écrase. En local : `node build.mjs` (Node 18+, sans dépendance).

## Thèmes

Deux thèmes : **Nuit** (`dark`, celui de toutes les applis maison aujourd'hui) et **Jour** (`light` : fond crème, cartes
plus claires que le fond, champs blancs, ambre plus foncé). Dans `tokens.css`, `:root` porte Nuit ; une appli passe en
Jour en posant `data-theme="light"` sur un élément. En Jour, le survol fonce (`amber-soft`) au lieu d'éclaircir, et le
texte posé sur l'ambre est blanc. Logos et mascottes sont générés avec les couleurs de Nuit ; sur fond clair, le logo
existe en `*-light` et `mark-on-light` (`amber-deep`, la valeur d'`amber` en Jour). Une mascotte garde ses yeux
presque noirs dans les deux thèmes.

Règles de génération : un `{{…}}` inconnu, une couleur invalide ou un jeton en double arrêtent le build ;
`tokens.css` ne contient jamais `>` ni `&` (Authentik les réécrit sur ses pages serveur).

## Fichiers publiés

| URL (`https://cocollet.github.io/brand/…`) | Contenu |
| --- | --- |
| `tokens.css` | variables `--cc-*` : couleurs (`--cc-amber`…, thème Nuit ; Jour sous `[data-theme="light"]`), espacements, rayons, polices, `--cc-type-<style>` (raccourci `font`) |
| `mascots/<nom>.svg` | `ok`, `hello`, `done`, `working`, `slow`, `down`, `denied`, `lost` — couleurs en attributs ; classes `cc-face` et `cc-eyes` pour animer les yeux (« en cours ») |
| `logo/<nom>.svg` | `mark`, `mark-on-light`, `mark-cream`, `favicon`, `lockup-dark`, `lockup-light` |
| `apps/immich.css` | habillage complet d'Immich (web), deux thèmes ; hors de `manifest.json`, les copies n'en ont pas besoin |
| `manifest.json` | liste des fichiers publiés et leur empreinte |

Les polices (Lora 600, Inter) ne sont pas ici : Google Fonts, ou servies par l'appli quand sa CSP l'impose.

## Qui consomme quoi

| Appli | Comment | Délai après un push ici |
| --- | --- | --- |
| Login Authentik (`custom.css` du Brand) | `@import` de `tokens.css`, mascotte « accès refusé » par URL | ~10 min (cache de GitHub Pages) |
| `Cocollet/hello` (colonne du login) | `tokens.css` par lien, même origine | ~10 min |
| `Cocollet/status` | copie dans `public/brand/` (la page reste autonome si GitHub tombe) | nuit, ou tout de suite avec `BRAND_DISPATCH_TOKEN` |
| `Cocollet/anonymizer` (Caviardage) | copie dans `app/static/brand/` (sa CSP interdit tout lien externe), puis `update-ok.sh` | idem, puis mise à jour du LXC |
| Immich (`photos.cocollet.ch`, web seulement) | champ *Custom CSS* = une ligne `@import` de `apps/immich.css` ; Nuit ou Jour selon le choix de chacun dans Immich | ~10 min |

Dans les copies, le workflow `sync-brand` (nuit, à la demande, ou prévenu par ce dépôt) télécharge `manifest.json`
et les fichiers qu'il liste, et commit s'il y a une différence.

## Brancher une nouvelle appli

1. **Lien ou copie ?** Lier `https://cocollet.github.io/brand/tokens.css` (et les SVG) si l'appli peut charger une
   ressource externe. Garder une **copie** si sa CSP l'interdit ou si elle doit rester entière quand GitHub tombe
   (page d'état) : reprendre `.github/workflows/sync-brand.yml` de `Cocollet/status` en changeant seulement `DEST`,
   et faire une première copie à la main (`manifest.json` + les fichiers qu'il liste).
2. **Couleurs, polices, rayons** : uniquement par les variables `--cc-*`. Une appli peut les renommer pour sa
   lisibilité (`--amber: var(--cc-amber)`), jamais recopier une valeur. Polices : Lora 600 et Inter, par Google Fonts
   ou servies par l'appli.
3. **Logo et mascottes** : les SVG de `logo/` et `mascots/`, par `<img>` ou par URL CSS. En SVG inline seulement pour
   animer (classes `cc-face` et `cc-eyes`) ; une mascotte par écran, à côté d'un texte qui dit la même chose.
4. **Une copie ?** Ajouter le dépôt à la boucle « Prévenir les applis » de `.github/workflows/build.yml` et au jeton
   `BRAND_DISPATCH_TOKEN` (*Contents: read and write*).
5. Ajouter l'appli au tableau « Qui consomme quoi » ci-dessus.

Le guide de marque (règles d'usage, composants, essais) est le système de design « Cocollet » sur claude.ai ; une
valeur qui y est validée se reporte ici.

⚠️ Le login charge `tokens.css` et Immich `apps/immich.css` : quiconque peut pousser ici peut changer leur apparence. Dépôt à protéger
comme le compte GitHub (2FA).
