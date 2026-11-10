/* ── SIMULATION DU VERDICT ÉQUILIBRE (Lamine, 10 novembre 2026) ─────────────
   Le vrai moteur de index.html, chargé en vm comme regles.test.cjs, joue des
   parties IA contre IA au verdict Équilibre, en 16 manches, premier joueur
   alterné d'une partie à l'autre.

     node tests/simuler-equilibre.cjs            → 2 000 parties par cas
     node tests/simuler-equilibre.cjs 500        → plus court

   Attendu : Sage ≥ 60 % contre l'Apprentie ; Sage (logique Équilibre) ≥ 55 %
   contre Sage (ancienne logique) ; égalités < 2 %. Sort en erreur sinon.
   Ce n'est pas un test de `node --test` : il est long, on le lance à la main. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function charger() {
  const saved = { atoutvie_guide: 'vu' }, nodes = new Map();
  const node = () => ({ hidden: true, style: {}, innerHTML: '', querySelector: () => null, classList: { add() {}, remove() {} }, getBoundingClientRect: () => ({ width: 390, height: 100, left: 0, top: 0 }) });
  const ctx = { console, Math, Date, Set, Map, JSON, Promise, navigator: { userAgent: 'simulation' }, location: { protocol: 'https:' }, innerWidth: 390, innerHeight: 844,
    matchMedia: () => ({ matches: false }), localStorage: { getItem: k => saved[k] ?? null, setItem: (k, v) => { saved[k] = v; }, removeItem: k => { delete saved[k]; } },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, requestAnimationFrame() {}, addEventListener() {},
    document: { hidden: false, addEventListener() {}, getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }, querySelector: () => null, querySelectorAll: () => [], body: { appendChild() {} }, createElement: node } };
  ctx.window = ctx; vm.createContext(ctx);
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) vm.runInContext(m[1], ctx);
  return ctx;
}

const AGENTS = {
  apprentie: { nom: 'Apprentie', choisir: (c, interdit, moi) => { const pl = c.iaChoisit(interdit, moi); pl.joker = c.jokerIA(pl.carte, moi); return pl; } },
  sage: { nom: 'Sage', choisir: (c, interdit, moi) => { const pl = c.sageChoisit(interdit, moi, 'equilibre'); pl.joker = c.jokerSage(pl.carte, pl.gain, moi, 'equilibre'); return pl; } },
  sageAncienne: { nom: 'Sage (ancienne logique)', choisir: (c, interdit, moi) => { const pl = c.sageChoisit(interdit, moi, 'classique'); pl.joker = c.jokerSage(pl.carte, pl.gain, moi, 'classique'); return pl; } },
};

/* Une partie : `a` et `b` sont des clés d'AGENTS ; `aOuvre` : a s'assoit en 1 (il ouvre la manche 1). */
function partie(c, a, b, graine, aOuvre) {
  const siege = aOuvre ? { 1: a, 2: b } : { 1: b, 2: a };
  const P = c.nouvellePartie({ manches: 16, verdict: 'equilibre', rnd: c.tirage(graine) });
  c.P = P;
  while (!c.finie(P)) {
    const o = P.initiative, s = o === 1 ? 2 : 1;
    const po = AGENTS[siege[o]].choisir(c, null, o);
    const ps = AGENTS[siege[s]].choisir(c, po.pil, s);
    if (!po.carte || !ps.carte) throw Error('aucune carte à jouer, manche ' + P.manche);
    const coup = { ['pilier' + o]: po.pil, ['carte' + o]: po.carte.id, ['pilier' + s]: ps.pil, ['carte' + s]: ps.carte.id };
    const jk = { [o]: po.joker, [s]: ps.joker };
    if (jk[1]) coup.joker = jk[1];
    if (jk[2]) coup.joker2 = jk[2];
    c.resoudreManche(P, coup);
  }
  const B = c.bilanPartie(P), campA = aOuvre ? 1 : 2, campB = aOuvre ? 2 : 1;
  const perdant = B.gagnant === null ? null : (B.gagnant === 1 ? 2 : 1);
  return {
    issue: B.gagnant === null ? 0 : (B.gagnant === campA ? 1 : -1), niveau: B.niveau,
    eqA: B.equilibre[campA], eqB: B.equilibre[campB],
    pilierAZeroPerdant: perdant !== null && Object.values(B.totaux[perdant]).some(v => v === 0),
    manches: P.historique.length,
  };
}

const mediane = v => { const t = v.slice().sort((x, y) => x - y), m = t.length >> 1; return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
const pc = (n, d) => (100 * n / d).toFixed(1) + ' %';

function cas(c, a, b, n, graine0) {
  const r = [];
  for (let i = 0; i < n; i++) r.push(partie(c, a, b, graine0 + i, i % 2 === 0));
  const gagnees = r.filter(x => x.issue > 0).length, perdues = r.filter(x => x.issue < 0).length, nulles = r.filter(x => x.issue === 0).length;
  const niveaux = {}; r.forEach(x => { niveaux[x.niveau] = (niveaux[x.niveau] || 0) + 1; });
  return {
    titre: AGENTS[a].nom + ' contre ' + AGENTS[b].nom, n,
    victoiresA: gagnees / n, victoiresB: perdues / n, egalites: nulles / n,
    pilierAZero: r.filter(x => x.pilierAZeroPerdant).length / Math.max(1, gagnees + perdues),
    medianeA: mediane(r.map(x => x.eqA)), medianeB: mediane(r.map(x => x.eqB)),
    manches: { mediane: mediane(r.map(x => x.manches)), min: Math.min(...r.map(x => x.manches)), max: Math.max(...r.map(x => x.manches)) },
    niveaux, nomA: AGENTS[a].nom, nomB: AGENTS[b].nom,
  };
}

function rapport(x) {
  return [
    `■ ${x.titre} — ${x.n} parties, premier joueur alterné`,
    `  Victoires ${x.nomA} : ${pc(x.victoiresA * x.n, x.n)} · ${x.nomB} : ${pc(x.victoiresB * x.n, x.n)} · égalités : ${pc(x.egalites * x.n, x.n)}`,
    `  Parties où le perdant a un pilier à 0 : ${pc(x.pilierAZero * 1000, 1000)}`,
    `  Médiane du score d'Équilibre : ${x.nomA} ${x.medianeA} · ${x.nomB} ${x.medianeB}`,
    `  Durée : ${x.manches.mediane} manches (de ${x.manches.min} à ${x.manches.max})`,
    `  Partie tranchée par : ${Object.entries(x.niveaux).map(([k, v]) => k + ' ' + pc(v, x.n)).join(' · ')}`,
  ].join('\n');
}

if (require.main === module) {
  const n = Number(process.argv[2]) || 2000;
  const c = charger();
  const t0 = Date.now();
  const r = [cas(c, 'sage', 'apprentie', n, 1000), cas(c, 'sage', 'sage', n, 50000), cas(c, 'sage', 'sageAncienne', n, 90000)];
  console.log(r.map(rapport).join('\n\n'));
  const attentes = [
    ['Sage ≥ 60 % contre l’Apprentie', r[0].victoiresA >= 0.60],
    ['Sage (Équilibre) ≥ 55 % contre Sage (ancienne logique)', r[2].victoiresA >= 0.55],
    ['égalités < 2 % dans chaque cas', r.every(x => x.egalites < 0.02)],
  ];
  console.log('\n' + attentes.map(([t, ok]) => (ok ? '✓ ' : '✗ ') + t).join('\n'));
  console.log(`\n(${Math.round((Date.now() - t0) / 1000)} s · poids ${JSON.stringify(c.POIDS_EQ)})`);
  if (!attentes.every(x => x[1])) process.exit(1);
}
module.exports = { charger, partie, cas };
