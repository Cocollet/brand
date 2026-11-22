// Génère la charte publiée à partir des sources : node build.mjs
//
//   tokens.json          → tokens.css (variables --cc-*)
//   src/logo/*.svg       → logo/*.svg      (une source, plusieurs déclinaisons de couleur, voir LOGOS)
//   src/mascots/*.svg    → mascots/*.svg   (teinte de marque et yeux pris dans tokens.json)
//   src/apps/*.css       → apps/*.css      (feuille complète pour une appli tierce, voir « Feuilles d'appli »)
//   tout                 → manifest.json (liste des fichiers publiés, lue par les applis qui en gardent une copie)
//                          index.html (page d'aperçu)
//
// Dans les sources SVG, {{nom}} est remplacé par la couleur du jeton « nom » (premier thème),
// ou par la variable de la déclinaison (LOGOS). Un {{…}} inconnu arrête la génération.
// Sans dépendance : Node 18 ou plus.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const tokens = JSON.parse(readFileSync('tokens.json', 'utf8'));
const themes = tokens.color.themes.map((t) => t.id);
const first = themes[0];

// --- Couleurs -------------------------------------------------------------------------------
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([^()]*\))$/i;
const colorOf = (tok, theme) => {
  const v = typeof tok.value === 'string' ? tok.value : (tok.value[theme] ?? tok.value[first]);
  if (!COLOR.test(v)) throw new Error(`couleur invalide pour ${tok.name} (${theme}) : ${v}`);
  return v.toLowerCase();
};
const color = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, colorOf(t, first)]));
const names = new Set();
for (const fam of ['color', 'spacing', 'radius', 'shadow']) {
  for (const t of tokens[fam]?.tokens ?? []) {
    if (names.has(t.name)) throw new Error(`jeton en double : ${t.name}`);
    names.add(t.name);
  }
}

// --- tokens.css -----------------------------------------------------------------------------
const decl = (name, value, usage) => `  --cc-${name}: ${value};${usage ? ` /* ${usage.replace(/\*\//g, '* /')} */` : ''}`;
const themed = (theme) => [
  ...tokens.color.tokens.map((t) => decl(t.name, colorOf(t, theme), theme === first ? t.usage : '')),
  ...(tokens.shadow?.tokens ?? []).map((t) => decl(t.name, typeof t.value === 'string' ? t.value : (t.value[theme] ?? t.value[first]), theme === first ? t.usage : '')),
];
const fam = tokens.type.families;
const fixed = [
  ...tokens.spacing.tokens.map((t) => decl(t.name, t.value, t.usage)),
  ...tokens.radius.tokens.map((t) => decl(t.name, t.value, t.usage)),
  ...Object.entries(fam).map(([k, v]) => decl(`font-${k}`, v)),
  ...tokens.type.groups.flatMap((g) => g.styles.map((s) =>
    decl(`type-${s.name}`, `${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--cc-font-${s.family || g.family})`, s.usage))),
  ...tokens.type.groups.flatMap((g) => g.styles.map((s) => decl(`type-${s.name}-tracking`, s.letterSpacing || '0'))),
];
let css = `/* Charte Cocollet — FICHIER GÉNÉRÉ par build.mjs depuis tokens.json : ne pas l'éditer.
   Source : https://github.com/Cocollet/brand — publié sur https://cocollet.github.io/brand/tokens.css
   Toutes les variables sont préfixées --cc- pour ne heurter aucune autre feuille (Authentik, PatternFly). */
:root {
${themed(first).join('\n')}
${fixed.join('\n')}
}
`;
for (const theme of themes.slice(1)) css += `[data-theme="${theme}"] {\n${themed(theme).join('\n')}\n}\n`;
// Authentik réécrit « > » et « & » dans les feuilles qu'il sert sur ses pages serveur : rien de tel ici.
if (/[>&]/.test(css)) throw new Error('tokens.css contient « > » ou « & » (illisible pour Authentik) : reformuler un « usage »');

// --- SVG ------------------------------------------------------------------------------------
const fill = (src, vars, file) => src.replace(/\{\{([a-z0-9-]+)\}\}/g, (_, k) => {
  const v = vars[k] ?? color[k];
  if (!v) throw new Error(`${file} : {{${k}}} n'est ni une variable ni un jeton de couleur`);
  return v;
});
// Déclinaisons du logo : fichier publié → source + couleurs.
const LOGOS = {
  'mark.svg':          ['mark.svg',    { mark: color.amber }],
  'mark-on-light.svg': ['mark.svg',    { mark: color['amber-deep'] }],
  'mark-cream.svg':    ['mark.svg',    { mark: color.text }],
  'favicon.svg':       ['favicon.svg', { mark: color.amber, tile: color['on-amber'] }],
  'lockup-dark.svg':   ['lockup.svg',  { mark: color.amber, ink: color.text }],
  'lockup-light.svg':  ['lockup.svg',  { mark: color['amber-deep'], ink: color['on-amber'] }],
};
const out = {};
for (const [name, [src, vars]] of Object.entries(LOGOS)) {
  out[`logo/${name}`] = fill(readFileSync(`src/logo/${src}`, 'utf8'), vars, `src/logo/${src}`);
}
const mascots = readdirSync('src/mascots').filter((f) => f.endsWith('.svg')).sort();
for (const f of mascots) out[`mascots/${f}`] = fill(readFileSync(`src/mascots/${f}`, 'utf8'), {}, `src/mascots/${f}`);
out['tokens.css'] = css;

// --- manifest.json --------------------------------------------------------------------------
const sha = (s) => createHash('sha256').update(s).digest('hex');
const manifest = { files: Object.fromEntries(Object.entries(out).map(([p, s]) => [p, sha(s)])) };
out['manifest.json'] = JSON.stringify(manifest, null, 2) + '\n';

// --- Feuilles d'appli -----------------------------------------------------------------------
// Pour une appli tierce qu'on habille par ses propres variables (Immich) : src/apps/<appli>.css est un
// gabarit où {{thème:jeton}} vaut la couleur du jeton dans ce thème ({{light:bg}}, {{dark:amber}}) et
// {{rgb:thème:jeton}} la même en triplet « R V B », pour les applis qui écrivent rgb(var(--x)).
// L'appli charge le fichier publié par une seule ligne @import : elle suit la charte sans rien recoller.
// Hors de manifest.json : les applis qui gardent une copie de la charte n'en ont pas besoin.
const byTheme = Object.fromEntries(themes.map((th) => [th, Object.fromEntries(tokens.color.tokens.map((t) => [t.name, colorOf(t, th)]))]));
const triplet = (hex, where) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(hex);
  if (!m) throw new Error(`${where} : ${hex} ne s'écrit pas en triplet RVB (il faut #rrggbb)`);
  return m.slice(1).map((h) => parseInt(h, 16)).join(' ');
};
const apps = {};
for (const f of existsSync('src/apps') ? readdirSync('src/apps').filter((n) => n.endsWith('.css')).sort() : []) {
  const sheet = readFileSync(`src/apps/${f}`, 'utf8').replace(/\{\{(rgb:)?([a-z0-9-]+):([a-z0-9-]+)\}\}/g, (all, asRgb, theme, name) => {
    const v = byTheme[theme]?.[name];
    if (!v) throw new Error(`src/apps/${f} : ${all} n'est pas un jeton de couleur d'un thème connu`);
    return asRgb ? triplet(v, `src/apps/${f} : ${all}`) : v;
  });
  if (sheet.includes('{{')) throw new Error(`src/apps/${f} : un {{…}} n'a pas été rempli`);
  apps[`apps/${f}`] = `/* FICHIER GÉNÉRÉ par build.mjs depuis src/apps/${f} et tokens.json : ne pas l'éditer. */\n${sheet}`;
}

// --- index.html (aperçu) --------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const swatches = tokens.color.tokens.map((t) => `<li>${themes.map((th) => `<i title="${th}" style="background:${byTheme[th][t.name]}"></i>`).join('')}<b>${t.name}</b><code>${themes.map((th) => byTheme[th][t.name]).join(' · ')}</code><span>${esc(t.usage)}</span></li>`).join('\n');
const pics = (dir, list) => list.map((f) => `<figure><img src="${dir}/${f}" alt=""><figcaption><a href="${dir}/${f}">${dir}/${f}</a></figcaption></figure>`).join('\n');
out['index.html'] = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Charte Cocollet</title>
<link rel="icon" href="logo/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@600&amp;family=Inter:wght@400;500;600&amp;display=swap">
<link rel="stylesheet" href="tokens.css">
<style>
body { margin: 0; background: var(--cc-bg); color: var(--cc-text); font: var(--cc-type-body); }
main { max-width: 1040px; margin: 0 auto; padding: 48px 24px; display: flex; flex-direction: column; gap: 40px; }
h1 { margin: 0; font: var(--cc-type-display-l); letter-spacing: var(--cc-type-display-l-tracking); }
h2 { margin: 0 0 16px; font: var(--cc-type-heading); }
p, code { color: var(--cc-text-soft); } a { color: var(--cc-amber); } a:hover { color: var(--cc-amber-soft); }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li { display: grid; grid-template-columns: repeat(${themes.length}, 28px) 140px ${themes.length * 90}px 1fr; gap: 12px; align-items: center; font-size: 13px; }
li i { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--cc-line); }
li span { color: var(--cc-text-muted); }
.grid { display: flex; flex-wrap: wrap; gap: 16px; }
figure { margin: 0; padding: 16px; background: var(--cc-surface); border: 1px solid var(--cc-line); border-radius: var(--cc-radius-l); display: flex; flex-direction: column; gap: 10px; align-items: center; }
figure img { height: 72px; max-width: 240px; } figure.light { background: #f3f0eb; } figure.light a { color: var(--cc-amber-deep); }
figcaption { font: var(--cc-type-meta); }
</style></head>
<body><main>
<h1>Charte Cocollet</h1>
<p>Fichiers générés depuis <a href="https://github.com/Cocollet/brand">Cocollet/brand</a>. À lier tels quels :
<code>https://cocollet.github.io/brand/tokens.css</code>, <code>…/mascots/&lt;nom&gt;.svg</code>, <code>…/logo/&lt;nom&gt;.svg</code>.</p>
<section><h2>Mascottes</h2><div class="grid">${pics('mascots', mascots)}</div></section>
<section><h2>Logos</h2><div class="grid">${pics('logo', Object.keys(LOGOS).filter((f) => !/light/.test(f)))}
${Object.keys(LOGOS).filter((f) => /light/.test(f)).map((f) => `<figure class="light"><img src="logo/${f}" alt=""><figcaption><a href="logo/${f}">logo/${f}</a></figcaption></figure>`).join('\n')}</div></section>
<section><h2>Couleurs</h2><p>Thèmes, dans l'ordre : ${tokens.color.themes.map((t) => esc(t.name)).join(', ')}. Le second s'active par <code>data-theme="${themes[1] ?? ''}"</code>.</p><ul>${swatches}</ul></section>
<section><h2>Feuilles d'appli</h2><p>${Object.keys(apps).map((p) => `<a href="${p}">${p}</a>`).join(' · ') || 'Aucune.'}</p></section>
</main></body></html>
`;

// --- Écriture -------------------------------------------------------------------------------
rmSync('logo', { recursive: true, force: true });
rmSync('mascots', { recursive: true, force: true });
rmSync('apps', { recursive: true, force: true });
mkdirSync('logo'); mkdirSync('mascots'); mkdirSync('apps');
Object.assign(out, apps);
for (const [p, s] of Object.entries(out)) writeFileSync(p, s);
console.log(`${Object.keys(out).length} fichiers générés (${mascots.length} mascottes, ${Object.keys(LOGOS).length} logos, ${Object.keys(apps).length} feuilles d'appli)`);
