/* ── SIMULATION DU VERDICT PILIERS (Lamine, 10 novembre 2026) ───────────────
   Le vrai moteur de index.html, chargé en vm, joue des parties IA contre IA
   au verdict Piliers, en 16 manches, premier joueur alterné d'une partie à
   l'autre ; la manche décisive est jouée quand il le faut.

     node tests/simuler-piliers.cjs            → 2 000 parties par cas
     node tests/simuler-piliers.cjs 500        → plus court

   Attendu : Sage ≥ 60 % contre l'Apprentie ; Sage (logique Piliers) ≥ 55 %
   contre Sage (ancienne logique) ; manche décisive ≤ 35 % des parties.
   Sort en erreur sinon. Pas un test de `node --test` : on le lance à la main. */
const { charger } = require('./simuler-equilibre.cjs');

const AGENTS = {
  apprentie: { nom: 'Apprentie', choisir: (c, interdit, moi) => { const pl = c.iaChoisit(interdit, moi); pl.joker = c.jokerIA(pl.carte, moi); return pl; } },
  sage: { nom: 'Sage', choisir: (c, interdit, moi) => { const pl = c.sageChoisit(interdit, moi, 'piliers'); pl.joker = c.jokerSage(pl.carte, pl.gain, moi, 'piliers'); return pl; } },
  sageAncienne: { nom: 'Sage (ancienne logique)', choisir: (c, interdit, moi) => { const pl = c.sageChoisit(interdit, moi, 'classique'); pl.joker = c.jokerSage(pl.carte, pl.gain, moi, 'classique'); return pl; } },
};

function partie(c, a, b, graine, aOuvre) {
  const siege = aOuvre ? { 1: a, 2: b } : { 1: b, 2: a };
  const P = c.nouvellePartie({ manches: 16, verdict: 'piliers', rnd: c.tirage(graine) });
  c.P = P;
  while (!c.manchesJouees(P)) {
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
  const avant = c.bilanPartie(P), campA = aOuvre ? 1 : 2;
  const compte = [avant.piliers.piliers[1].length, avant.piliers.piliers[2].length].sort((x, y) => y - x).join('-');
  let decisive = null;
  if (c.besoinDecisive(P)) {
    const d = c.preparerDecisive(P);
    const coups = {}; [1, 2].forEach(j => { coups[j] = c.choixDecisive(P, j).id; });
    c.resoudreDecisive(P, coups);
    decisive = { ouvreurGagne: d.gagnantJoueur === d.ordre[0], aGagne: d.gagnant === campA };
  }
  const B = c.bilanPartie(P);
  return { issue: B.gagnant === null ? 0 : (B.gagnant === campA ? 1 : -1), compte, decisive, razzia: B.razzia };
}

const pc = (n, d) => (100 * n / d).toFixed(1) + ' %';
function cas(c, a, b, n, graine0) {
  const r = [];
  for (let i = 0; i < n; i++) r.push(partie(c, a, b, graine0 + i, i % 2 === 0));
  const dec = r.filter(x => x.decisive);
  const comptes = {}; r.forEach(x => { comptes[x.compte] = (comptes[x.compte] || 0) + 1; });
  return {
    titre: AGENTS[a].nom + ' contre ' + AGENTS[b].nom, n, nomA: AGENTS[a].nom, nomB: AGENTS[b].nom,
    victoiresA: r.filter(x => x.issue > 0).length / n, victoiresB: r.filter(x => x.issue < 0).length / n, nulles: r.filter(x => x.issue === 0).length / n,
    razzia: (comptes['4-0'] || 0) / n, troisUn: (comptes['3-1'] || 0) / n, deuxDeux: (comptes['2-2'] || 0) / n,
    comptes, decisive: dec.length / n,
    decisiveOuvreur: dec.length ? dec.filter(x => x.decisive.ouvreurGagne).length / dec.length : 0,
    decisiveA: dec.length ? dec.filter(x => x.decisive.aGagne).length / dec.length : 0,
  };
}
function rapport(x) {
  const autres = Object.entries(x.comptes).sort((p, q) => q[1] - p[1]).map(([k, v]) => k + ' ' + pc(v, x.n)).join(' · ');
  return [
    `■ ${x.titre} — ${x.n} parties, premier joueur alterné`,
    `  Victoires ${x.nomA} : ${pc(x.victoiresA, 1)} · ${x.nomB} : ${pc(x.victoiresB, 1)}${x.nulles ? ' · nulles : ' + pc(x.nulles, 1) : ''}`,
    `  Compte des piliers après 16 manches : 4-0 ${pc(x.razzia, 1)} · 3-1 ${pc(x.troisUn, 1)} · 2-2 ${pc(x.deuxDeux, 1)}  (détail : ${autres})`,
    `  Manche décisive : ${pc(x.decisive, 1)} des parties — gagnée par celui qui l’ouvre ${pc(x.decisiveOuvreur, 1)}, par ${x.nomA} ${pc(x.decisiveA, 1)}`,
  ].join('\n');
}

if (require.main === module) {
  const n = Number(process.argv[2]) || 2000;
  const c = charger(), t0 = Date.now();
  const r = [cas(c, 'sage', 'apprentie', n, 1000), cas(c, 'sage', 'sage', n, 50000), cas(c, 'sage', 'sageAncienne', n, 90000)];
  console.log(r.map(rapport).join('\n\n'));
  const attentes = [
    ['Sage ≥ 60 % contre l’Apprentie', r[0].victoiresA >= 0.60],
    ['Sage (Piliers) ≥ 55 % contre Sage (ancienne logique)', r[2].victoiresA >= 0.55],
    ['manche décisive ≤ 35 % des parties, dans chaque cas', r.every(x => x.decisive <= 0.35)],
  ];
  console.log('\n' + attentes.map(([t, ok]) => (ok ? '✓ ' : '✗ ') + t).join('\n'));
  console.log(`\n(${Math.round((Date.now() - t0) / 1000)} s · poids ${JSON.stringify(c.POIDS_PIL)})`);
  if (!attentes.every(x => x[1])) process.exit(1);
}
module.exports = { partie, cas };
