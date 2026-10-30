const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function jeu(saved={}){
  if(!("atoutvie_guide" in saved))saved.atoutvie_guide="vu";
  const nodes=new Map(),timers=new Map();let tid=0;
  function node(){return {hidden:true,style:{},innerHTML:'',querySelector:()=>null,classList:{add(){},remove(){}},getBoundingClientRect:()=>({width:390,height:100,left:0,top:0})};}
  const ctx={console,Math,Date,Set,Map,JSON,Promise,navigator:{userAgent:'iPhone',platform:'iPhone'},location:{protocol:'https:'},innerWidth:390,innerHeight:844,matchMedia:()=>({matches:false}),localStorage:{getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=v,removeItem:k=>{delete saved[k];}},setTimeout(f,ms){timers.set(++tid,{f,ms});return tid;},clearTimeout:id=>timers.delete(id),setInterval(){},clearInterval(){},requestAnimationFrame(){},addEventListener(){},document:{hidden:false,addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},querySelector:()=>null,querySelectorAll:()=>[],body:{appendChild(){}},createElement:node}};
  ctx.window=ctx;vm.createContext(ctx);
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],ctx);
  return {c:ctx,nodes,timers,saved};
}
const piliers=['Spiritualité','Amour','Santé','Argent'];
const carte=(id,pilier,pts)=>({id,pilier,pts,nom:'Test',cit:''});
function manche(c,p,pil='Santé',extra={},gagnant=1){
  const autre=piliers.find(x=>x!==pil);
  p.mains={1:[carte('a',gagnant===1?pil:autre,gagnant===1?40:5)],2:[carte('b',gagnant===2?pil:autre,gagnant===2?40:5)]};p.pioche=[];
  return c.resoudreManche(p,{pilier1:p.mains[1][0].pilier,pilier2:p.mains[2][0].pilier,carte1:'a',carte2:'b',...extra});
}
test('distribution : 32 cartes, 10 par joueur, 12 en pioche et 2 jokers chacun',()=>{
  const {c}=jeu(),p=c.P;
  assert.equal(p.mains[1].length,10);assert.equal(p.mains[2].length,10);assert.equal(p.pioche.length,12);
  assert.equal(p.jokers[1].length,2);assert.equal(p.jokers[2].length,2);
  assert.equal(new Set([...p.mains[1],...p.mains[2],...p.pioche].map(x=>x.id)).size,32);
});
test('bouclier : activation + manche suivante, retour puis destruction du même joker',()=>{
  const {c}=jeu(),p=c.nouvellePartie();p.jokers={1:[{id:'j4'}],2:[{id:'j1'}]};
  let r=manche(c,p,'Santé',{joker:'j4',joker2:'j1'});
  assert.equal(r.bloque[2],true);assert.equal(r.gagnant,1);assert.equal(p.bouclier[1].restantes,1);assert.equal(p.jokers[2][0].bloques,1);
  r=manche(c,p,'Santé',{joker2:'j1'});assert.equal(r.bloque[2],true);assert.equal(r.perdu[2],'j1');assert.equal(p.jokers[2].length,0);assert.equal(p.bouclier[1],null);
  p.jokers[2]=[{id:'j2'}];r=manche(c,p,'Santé',{joker2:'j2'});assert.equal(r.protege[1],false);assert.equal(r.butin,90);
});
test('les deux manches de protection passent même sans attaque',()=>{
  const {c}=jeu(),p=c.nouvellePartie();p.jokers={1:[{id:'j4'}],2:[]};
  manche(c,p,'Santé',{joker:'j4'});manche(c,p);assert.equal(p.bouclier[1],null);
});
test('les compteurs de blocage des jokers ne passent pas à la prochaine partie',()=>{
  const {c}=jeu(),p=c.nouvellePartie();p.jokers[1][0].bloques=1;p.jokers[2][0].bloques=1;
  const q=c.nouvellePartie();assert.ok([...q.jokers[1],...q.jokers[2]].every(j=>!j.bloques));
});
test('bonus : un seul +40 par joueur, sur ses quatre piliers gagnés, hors multiplication',()=>{
  const {c}=jeu(),p=c.nouvellePartie();p.jokers={1:[],2:[]};
  for(const pil of piliers.slice(0,3))assert.equal(manche(c,p,pil).bonus,0);
  assert.equal(p.piliersGagnes[1].length,3);assert.equal(p.piliersGagnes[2].length,0);
  p.jokers[1]=[{id:'j2'}];let r=manche(c,p,piliers[3],{joker:'j2'});
  assert.equal(r.bonus,40);assert.equal(r.butin,90);assert.equal(p.s1,3*45+90+40);
  assert.equal(manche(c,p).bonus,0);
  for(const pil of piliers)r=manche(c,p,pil,{},2);
  assert.equal(r.bonus,40);assert.equal(p.s2,4*45+40);assert.equal(manche(c,p,'Santé',{},2).bonus,0);
});
test('durée : la partie en cours reste intacte, choix conservé au prochain démarrage',()=>{
  const {c,saved}=jeu();c.reglerManches(16);assert.equal(c.P.total,10);assert.equal(saved.atoutvie_manches,'16');
  c.neuf();assert.equal(c.P.total,16);c.reglerManches(3);assert.equal(c.manchesSuivantes,16);
  assert.equal(jeu(saved).c.P.total,16);assert.equal(jeu({atoutvie_manches:'abc'}).c.P.total,10);
});
test('IA : tous les jokers sont utilisables et son choix ne lit pas la main adverse',()=>{
  const {c}=jeu();
  for(const [id,pts] of [['j1',20],['j2',40],['j4',40]]){
    c.P.jokers[2]=[{id}];assert.equal(c.jokerIA(carte('x','Amour',pts)),id);
  }
  c.P.jokers[2]=[{id:'j5'}];c.P.mains[2]=[carte('x','Amour',5)];
  assert.equal(c.iaChoisit('Santé').carte.id,'fantome');
  Object.defineProperty(c.P.mains,1,{get(){throw Error('main adverse consultée');}});
  Object.defineProperty(c.P.jokers,1,{get(){throw Error('jokers adverses consultés');}});
  c.preparerIA('Santé');const plan=c.planIA;c.preparerIA('Amour');assert.equal(c.planIA,plan);
});
test('Fantôme humain et IA : valeurs réelles entières résolues une seule fois',()=>{
  const {c}=jeu();c.P.jokers={1:[{id:'j5'}],2:[{id:'j4'}]};c.P.mains[2]=[carte('x','Santé',40)];
  c.jouerFantomeSur('Amour');assert.equal(c.etape,'verdict');assert.equal(c.dernier.jokers[2],'j4');assert.ok(Number.isInteger(c.cJ.pts));
  c.neuf();c.P.jokers={1:[],2:[{id:'j5'}]};c.P.mains[2]=[carte('x','Amour',5)];c.P.mains[1]=[carte('y','Santé',40)];
  c.choisirPilier('Santé');c.jouerCarte('y');assert.equal(c.cIA.id,'fantome');assert.ok(Number.isInteger(c.cIA.pts));assert.ok(c.cIA.pts>=5&&c.cIA.pts<=50);
});
test('l’aide et les paramètres suspendent la transition automatique',()=>{
  const {c,timers,nodes}=jeu();c.choisirPilier(c.P.mains[1][0].pilier);c.jouerCarte(c.P.mains[1].find(x=>x.pilier===c.pilJ).id);
  c.ouvrirReglages();timers.get(c.minuterie).f();assert.equal(c.etape,'verdict');
  c.reglagesOuverts=false;c.aideOuverte=true;timers.get(c.minuterie).f();assert.equal(c.etape,'verdict');assert.match(c.aideHTML(),/Bonus Équilibre/);
  c.aideOuverte=false;timers.get(c.minuterie).f();assert.equal(c.etape,'pilier');
  assert.ok(nodes.get('app').innerHTML.includes('Paramètres'));assert.ok(!c.reglagesHTML().includes('Statistiques'));
  c.ouvrirStats();assert.equal(c.statsOuvertes,false);
});
test('160 parties complètes : 8, 10, 12 et 16 manches, scores et cartes cohérents',()=>{
  const {c}=jeu();let seed=1843;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  c.rendreFin=()=>{};
  for(const total of [8,10,12,16])for(let i=0;i<40;i++){
    c.neuf();c.P=c.nouvellePartie({manches:total,rnd});c.tour();
    while(!c.finie(c.P)){
      const options=c.pilIA?c.piliersRepondables(c.P,1,c.pilIA):c.piliersOuvrables(c.P,1);
      if(c.P.jokers[1].some(j=>j.id==='j5')&&rnd()<.25){c.jouerFantomeSur(piliers.find(p=>p!==c.pilIA));}
      else{
        c.choisirPilier(options[Math.floor(rnd()*options.length)]);
        const j=c.P.jokers[1].find(j=>j.id!=='j5');if(j&&rnd()<.5)c.jokerArme=j.id;
        c.jouerCarte(c.P.mains[1].find(x=>x.pilier===c.pilJ).id);
      }
      assert.equal(c.etape,'verdict');c.suivante();
    }
    assert.equal(c.P.historique.length,total);
    for(const joueur of [1,2])assert.equal(c.P['s'+joueur],c.P.historique.filter(h=>h.gagnant===joueur).reduce((s,h)=>s+h.butin+h.bonus,0));
    const ordinaires=[...c.P.mains[1],...c.P.mains[2],...c.P.pioche,...Object.values(c.P.plis).flat()].filter(c=>!c.fantome);
    assert.equal(ordinaires.length,32);assert.equal(new Set(ordinaires.map(c=>c.id)).size,32);
  }
});

/* ── Ajouts du 30 octobre 2026 : Sage, donne du jour, reprise, citation, palmarès ── */
function partieGloutonne(c,rnd){
  c.neuf();c.P=c.nouvellePartie({manches:10,rnd});c.tour();
  while(!c.finie(c.P)){
    const P=c.P,options=c.pilIA?c.piliersRepondables(P,1,c.pilIA):c.piliersOuvrables(P,1);
    let best=null;for(const p of options)for(const x of P.mains[1])if(x.pilier===p&&(!best||x.pts>best.pts))best=x;
    c.choisirPilier(best.pilier);
    const j=P.jokers[1].find(j=>j.id!=='j5');
    if(j){if(j.id==='j1'&&best.pts<=20)c.jokerArme='j1';if(j.id!=='j1'&&best.pts>=40)c.jokerArme=j.id;}
    c.jouerCarte(best.id);c.suivante();
  }
  return c.P.s1>c.P.s2;
}
test('la Sage ne lit ni la main ni les jokers adverses',()=>{
  const {c}=jeu({atoutvie_niveau:'sage'});assert.equal(c.niveau,'sage');
  Object.defineProperty(c.P.mains,1,{get(){throw Error('main adverse consultée');}});
  Object.defineProperty(c.P.jokers,1,{get(){throw Error('jokers adverses consultés');}});
  c.preparerIA('Santé');assert.ok(c.planIA.carte);assert.ok(c.planIA.gain>=0&&c.planIA.gain<=1);
});
test('la Sage est nettement plus forte que l’Apprentie (600 parties chacune)',()=>{
  const joue=(niveau)=>{const {c}=jeu({atoutvie_niveau:niveau});c.rendreFin=()=>{};let seed=4242;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    let w=0;for(let i=0;i<600;i++)if(partieGloutonne(c,rnd))w++;return w/600;};
  const vsApprentie=joue('apprentie'),vsSage=joue('sage');
  assert.ok(vsApprentie>0.45,'Apprentie trop forte : '+vsApprentie);
  assert.ok(vsSage<vsApprentie-0.08,'la Sage ne domine pas : '+vsSage+' contre '+vsApprentie);
});
test('donne du jour : même graine, mêmes mains, mêmes Fantômes',()=>{
  const {c}=jeu();const g=c.graineDuJour(new Date(2026,9,30));
  assert.equal(g.jour,20261030);assert.equal(g.graine,c.graineDuJour(new Date(2026,9,30)).graine);
  const a=c.nouvellePartie({rnd:c.tirage(g.graine)}),b=c.nouvellePartie({rnd:c.tirage(g.graine)});
  assert.equal(a.mains[1].map(x=>x.id).join(),b.mains[1].map(x=>x.id).join());assert.equal(JSON.stringify(a.jokers),JSON.stringify(b.jokers));
  assert.equal(c.jouerFantome(a,a.jokers[1].some(j=>j.id==='j5')?1:2,'Amour').pts,c.jouerFantome(b,b.jokers[1].some(j=>j.id==='j5')?1:2,'Amour').pts);
  c.donneDuJour();assert.equal(c.P.donne,c.graineDuJour().jour);assert.equal(c.P.total,10);
  assert.ok(c.reglagesHTML.call(Object.assign(c,{reglagesOuverts:true})).includes('Donne du jour'));
});
test('reprise : une partie interrompue reprend à la même manche, avec les mêmes cartes',()=>{
  const {c,saved}=jeu();c.choisirPilier(c.P.mains[1][0].pilier);c.jouerCarte(c.P.mains[1].find(x=>x.pilier===c.pilJ).id);c.suivante();
  assert.equal(c.P.manche,2);const mains=c.P.mains[1].map(x=>x.id).join(),s=c.P.s1+'-'+c.P.s2;
  const r=jeu(saved);assert.equal(r.c.P.manche,2);assert.equal(r.c.P.mains[1].map(x=>x.id).join(),mains);assert.equal(r.c.P.s1+'-'+r.c.P.s2,s);
  assert.equal(typeof r.c.P.rnd,'function');
  // Une partie terminée n'est pas reprise.
  r.c.P.manche=r.c.P.total+1;r.c.tour();assert.equal(saved.atoutvie_partie,undefined);
});
test('verdict : la citation de la carte gagnante est affichée',()=>{
  const {c,nodes}=jeu();c.choisirPilier(c.P.mains[1][0].pilier);c.jouerCarte(c.P.mains[1].find(x=>x.pilier===c.pilJ).id);
  const d=c.dernier,g=d.gagnant===d.ouvreur?d['c'+d.ouvreur]:d['c'+(d.ouvreur===1?2:1)];
  assert.ok(nodes.get('app').innerHTML.includes('« '+g.cit+' »'));
});
test('palmarès visible sans code ; guide à la première ouverture seulement',()=>{
  const {c,nodes}=jeu({});c.palmaresOuvert=true;c.rendre();assert.match(nodes.get('app').innerHTML,/MON PALMARÈS/);
  const g=jeu({atoutvie_guide:undefined});assert.equal(g.c.guideOuvert,true);g.c.fermerGuide();assert.equal(g.saved.atoutvie_guide,'vu');assert.equal(jeu(g.saved).c.guideOuvert,false);
});

/* ── La table à 4 (30 octobre 2026) ── */
const seed4=(s)=>{let x=s;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);};
function coupsIA(c,p){const coups=[];for(const j of c.ordreManche4(p)){const d=c.ia4(p,j,coups);coups.push({joueur:j,pilier:d.pilier,carte:d.carte.id,joker:d.joker});}return coups;}
test('table à 4 : 8 cartes chacun, pas de pioche, un joker chacun, ouvreur tiré au sort',()=>{
  const {c}=jeu();const p=c.nouvelleTable4({rnd:seed4(1)});
  for(const j of [1,2,3,4]){assert.equal(p.mains[j].length,8);assert.equal(p.jokers[j].length,1);}
  assert.equal(p.pioche.length,0);assert.equal(p.total,8);assert.ok(p.ouvreur>=1&&p.ouvreur<=4);
  assert.equal(new Set([1,2,3,4].flatMap(j=>p.mains[j].map(x=>x.id))).size,32);
  assert.equal(new Set([1,2,3,4].map(j=>p.jokers[j][0].id)).size,4);
  const o=[];for(let s=0;s<40;s++)o.push(c.nouvelleTable4({rnd:seed4(s)}).ouvreur);assert.equal(new Set(o).size,4);
});
test('table à 4 : quatre piliers différents, la plus forte gagne pour son équipe, égalité au premier posé',()=>{
  const {c}=jeu();const p=c.nouvelleTable4({rnd:seed4(2)});p.ouvreur=1;p.jokers={1:[],2:[],3:[],4:[]};
  const carte=(id,pil,pts)=>({id,pilier:pil,pts,nom:'T',cit:''});
  p.mains={1:[carte('a','Santé',40)],2:[carte('b','Amour',40)],3:[carte('c','Argent',5)],4:[carte('d','Spiritualité',50)]};
  const h=c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'a'},{joueur:2,pilier:'Amour',carte:'b'},{joueur:3,pilier:'Argent',carte:'c'},{joueur:4,pilier:'Spiritualité',carte:'d'}]);
  assert.equal(h.gagnant,4);assert.equal(h.equipe,'eux');assert.equal(h.butin,135);assert.equal(p.scores.eux,135);assert.equal(p.ouvreur,2);
  // Égalité : 40 contre 40, le premier posé (joueur 1) l'emporte.
  p.mains={1:[carte('e','Santé',40)],2:[carte('f','Amour',40)],3:[carte('g','Argent',5)],4:[carte('h','Spiritualité',5)]};p.ouvreur=1;
  const h2=c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'e'},{joueur:2,pilier:'Amour',carte:'f'},{joueur:3,pilier:'Argent',carte:'g'},{joueur:4,pilier:'Spiritualité',carte:'h'}]);
  assert.equal(h2.gagnant,1);assert.equal(p.scores.nous,90);
  // Un pilier libre ne peut pas être pris deux fois par la même équipe, ni un pilier pris par le partenaire.
  p.mains={1:[carte('i','Santé',40)],2:[carte('j','Amour',40)],3:[carte('k','Santé',30),carte('k2','Argent',5)],4:[carte('l','Spiritualité',5)]};p.ouvreur=1;
  assert.throws(()=>c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'i'},{joueur:2,pilier:'Amour',carte:'j'},{joueur:3,pilier:'Santé',carte:'k'},{joueur:4,pilier:'Spiritualité',carte:'l'}]),/ne peut pas prendre/);
});
test('table à 4 : la contestation se règle à part, le bluff vaut 0, un pilier ne se conteste qu’une fois',()=>{
  const {c}=jeu();const p=c.nouvelleTable4({rnd:seed4(3)});p.ouvreur=1;p.jokers={1:[],2:[],3:[],4:[]};
  const carte=(id,pil,pts)=>({id,pilier:pil,pts,nom:'T',cit:''});
  // Est conteste la Santé de Toi avec un 50 de Santé : il gagne la manche (pot 50+40+10+5=105) ET la prime (50+40=90).
  p.mains={1:[carte('a','Santé',40)],2:[carte('b','Santé',50),carte('b2','Amour',5)],3:[carte('c','Argent',10)],4:[carte('d','Spiritualité',5)]};
  let h=c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'a'},{joueur:2,pilier:'Santé',carte:'b'},{joueur:3,pilier:'Argent',carte:'c'},{joueur:4,pilier:'Spiritualité',carte:'d'}]);
  assert.equal(h.poses[1].conteste,true);assert.equal(h.gagnant,2);assert.equal(h.butin,105);assert.equal(h.primes.length,1);
  assert.equal(h.primes[0].montant,90);assert.equal(h.primes[0].equipe,'eux');assert.equal(h.primes[0].tenu,false);assert.equal(p.scores.eux,195);
  // Bluff : Est conteste Santé avec un Amour. Sa carte vaut 0 ; Toi tient la contestation et prend 40+0 ; la manche va à Ouest (50).
  p.mains={1:[carte('e','Santé',40)],2:[carte('f','Amour',30),carte('f2','Argent',5)],3:[carte('g','Argent',10)],4:[carte('h','Spiritualité',50)]};p.ouvreur=1;p.scores={nous:0,eux:0};
  h=c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'e'},{joueur:2,pilier:'Santé',carte:'f'},{joueur:3,pilier:'Argent',carte:'g'},{joueur:4,pilier:'Spiritualité',carte:'h'}]);
  assert.equal(h.poses[1].morte,true);assert.equal(h.poses[1].valeur,0);assert.equal(h.gagnant,4);assert.equal(h.butin,100);
  assert.equal(h.primes[0].tenu,true);assert.equal(h.primes[0].montant,40);assert.deepEqual([p.scores.nous,p.scores.eux],[40,100]);
  // Ouest ne peut pas contester un pilier déjà contesté ; Nord ne peut pas contester le pilier de son partenaire.
  p.mains={1:[carte('i','Santé',40)],2:[carte('j','Santé',50)],3:[carte('k','Santé',30),carte('k2','Argent',5)],4:[carte('l','Santé',45),carte('l2','Spiritualité',5)]};p.ouvreur=1;
  assert.throws(()=>c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'i'},{joueur:2,pilier:'Santé',carte:'j'},{joueur:3,pilier:'Argent',carte:'k2'},{joueur:4,pilier:'Santé',carte:'l'}]),/ne peut pas prendre/);
  p.mains={1:[carte('m','Santé',40)],2:[carte('n','Amour',50)],3:[carte('o','Santé',30),carte('o2','Argent',5)],4:[carte('q','Spiritualité',5)]};p.ouvreur=1;
  assert.throws(()=>c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'m'},{joueur:2,pilier:'Amour',carte:'n'},{joueur:3,pilier:'Santé',carte:'o'},{joueur:4,pilier:'Spiritualité',carte:'q'}]),/ne peut pas prendre/);
});
test('table à 4 : carte morte seulement sans carte d’un pilier libre ; jokers d’équipe ; bonus par équipe',()=>{
  const {c}=jeu();const p=c.nouvelleTable4({rnd:seed4(4)});p.ouvreur=1;
  const carte=(id,pil,pts)=>({id,pilier:pil,pts,nom:'T',cit:''});
  // Ouest n'a que de l'Amour alors qu'Amour est pris : carte morte autorisée sur Spiritualité, valeur 0.
  p.jokers={1:[],2:[],3:[],4:[]};
  p.mains={1:[carte('a','Santé',40)],2:[carte('b','Amour',20)],3:[carte('c','Argent',10)],4:[carte('d','Amour',50)]};
  let h=c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'a'},{joueur:2,pilier:'Amour',carte:'b'},{joueur:3,pilier:'Argent',carte:'c'},{joueur:4,pilier:'Spiritualité',carte:'d'}]);
  assert.equal(h.poses[3].morte,true);assert.equal(h.butin,70);assert.equal(h.gagnant,1);
  // Mais avec une carte d'un pilier libre en main, la carte morte est refusée.
  p.mains={1:[carte('e','Santé',40)],2:[carte('f','Amour',20)],3:[carte('g','Argent',10)],4:[carte('h','Amour',50),carte('h2','Spiritualité',5)]};p.ouvreur=1;
  assert.throws(()=>c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'e'},{joueur:2,pilier:'Amour',carte:'f'},{joueur:3,pilier:'Argent',carte:'g'},{joueur:4,pilier:'Spiritualité',carte:'h'}]),/carte morte/);
  // Brakeur d'Est bloqué par le Bouclier de Nord (équipe) : il revient ; Multiplicateur d'Ouest double le pot.
  p.jokers={1:[],2:[{id:'j1'}],3:[{id:'j4'}],4:[{id:'j2'}]};
  p.mains={1:[carte('i','Santé',40)],2:[carte('j','Amour',5)],3:[carte('k','Argent',10)],4:[carte('l','Spiritualité',5)]};p.ouvreur=1;p.scores={nous:0,eux:0};
  h=c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'i'},{joueur:2,pilier:'Amour',carte:'j',joker:'j1'},{joueur:3,pilier:'Argent',carte:'k',joker:'j4'},{joueur:4,pilier:'Spiritualité',carte:'l',joker:'j2'}]);
  assert.equal(h.bloque[2],true);assert.equal(p.jokers[2].length,1);assert.equal(h.bloque[4],true);assert.equal(h.gagnant,1);assert.equal(h.butin,60);assert.equal(p.scores.nous,60);
  // Bonus Équilibre : l'équipe qui gagne dans les quatre piliers.
  p.piliersGagnes.nous=['Santé','Amour','Argent'];p.jokers={1:[],2:[],3:[],4:[]};
  p.mains={1:[carte('m','Spiritualité',50)],2:[carte('n','Amour',5)],3:[carte('o','Argent',5)],4:[carte('q','Santé',5)]};p.ouvreur=1;
  h=c.resoudreManche4(p,[{joueur:1,pilier:'Spiritualité',carte:'m'},{joueur:2,pilier:'Amour',carte:'n'},{joueur:3,pilier:'Argent',carte:'o'},{joueur:4,pilier:'Santé',carte:'q'}]);
  assert.equal(h.bonus,40);assert.equal(p.bonusEquilibre.nous,true);
});
test('table à 4 : l’IA ne lit que sa main ; 300 parties complètes cohérentes et équilibrées',()=>{
  const {c}=jeu();const rnd=seed4(5);let nous=0,contests=0;
  for(let i=0;i<300;i++){const p=c.nouvelleTable4({rnd});
    while(!c.finie(p)){
      const coups=[];
      for(const j of c.ordreManche4(p)){
        const autres=[1,2,3,4].filter(x=>x!==j),mains=p.mains,jokers=p.jokers;
        p.mains=new Proxy(mains,{get(t,k){if(autres.includes(+k))throw Error('main '+k+' consultée par '+j);return t[k];}});
        p.jokers=new Proxy(jokers,{get(t,k){if(autres.includes(+k))throw Error('jokers '+k+' consultés par '+j);return t[k];}});
        const d=c.ia4(p,j,coups);p.mains=mains;p.jokers=jokers;
        coups.push({joueur:j,pilier:d.pilier,carte:d.carte.id,joker:d.joker});
      }
      const h=c.resoudreManche4(p,coups);contests+=h.primes.length;
    }
    assert.equal(p.historique.length,8);
    const attendu={nous:0,eux:0};p.historique.forEach(h=>{attendu[h.equipe]+=h.butin+h.bonus;h.primes.forEach(pr=>attendu[pr.equipe]+=pr.montant);});
    assert.deepEqual([p.scores.nous,p.scores.eux],[attendu.nous,attendu.eux]);
    if(p.scores.nous>p.scores.eux)nous++;
  }
  assert.ok(nous>105&&nous<195,'déséquilibre : '+nous+'/300');assert.ok(contests>300,'trop peu de contestations : '+contests);
});
test('table à 4 à l’écran : une partie complète au doigt, reprise après interruption',()=>{
  const {c,timers,nodes,saved}=jeu({atoutvie_mode:'table4'});assert.equal(c.P.mode,'table4');
  const avancer=()=>{for(let i=0;i<200;i++){if(c.etape==='pilier'||c.etape==='verdict'||nodes.get('app').innerHTML.includes('class="fin"'))return;const [id,t]=[...timers.entries()][0]||[];if(!id)return;timers.delete(id);t.f();}};
  let manches=0,repris=false;
  for(let tour=0;tour<60;tour++){
    avancer();
    if(nodes.get('app').innerHTML.includes('class="fin"'))break;
    if(c.etape==='pilier'){
      assert.ok(nodes.get('app').innerHTML.includes('NOUS · piliers'));
      const o=c.options4(c.P,1,c.coups4);const pil=o.avecCarte[0]||o.contestables[0]||o.mortes[0];
      c.choisirPilier(pil);assert.equal(c.etape,'poser');
      const k=c.P.mains[1].find(x=>x.pilier===pil)||c.P.mains[1][0];c.jouerCarte(k.id);
    }else if(c.etape==='verdict'){
      manches++;assert.equal(c.P.historique.length,manches);
      if(manches===2&&!repris){repris=true;const r=jeu(saved);assert.equal(r.c.P.mode,'table4');assert.equal(r.c.P.manche,2);}
      c.suivante();
    }
  }
  assert.equal(manches,8);assert.match(nodes.get('app').innerHTML,/TABLE À 4/);assert.equal(saved.atoutvie_partie,undefined);
});
