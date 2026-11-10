const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function jeu(saved={},env={}){
  if(!("atoutvie_guide" in saved))saved.atoutvie_guide="vu";
  const nodes=new Map(),timers=new Map();let tid=0;
  function node(){return {hidden:true,style:{},innerHTML:'',querySelector:()=>null,classList:{add(){},remove(){}},getBoundingClientRect:()=>({width:390,height:100,left:0,top:0})};}
  const ctx={console,Math,Date,Set,Map,JSON,Promise,navigator:{userAgent:'iPhone',platform:'iPhone'},location:{protocol:'https:'},innerWidth:390,innerHeight:844,matchMedia:()=>({matches:false}),localStorage:{getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=v,removeItem:k=>{delete saved[k];}},setTimeout(f,ms){timers.set(++tid,{f,ms});return tid;},clearTimeout:id=>timers.delete(id),setInterval(){},clearInterval(){},requestAnimationFrame(){},addEventListener(){},document:{hidden:false,addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},querySelector:()=>null,querySelectorAll:()=>[],body:{appendChild(){}},createElement:node}};
  Object.assign(ctx,env);ctx.window=ctx;vm.createContext(ctx);
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
test('durée (Classique) : la partie en cours reste intacte, choix conservé au prochain démarrage',()=>{
  const {c,saved}=jeu({atoutvie_verdict:'classique'});c.reglerManches(16);assert.equal(c.P.total,10);assert.equal(saved.atoutvie_manches,'16');
  c.neuf();assert.equal(c.P.total,16);c.reglerManches(3);assert.equal(c.manchesSuivantes,16);
  assert.equal(jeu(saved).c.P.total,16);assert.equal(jeu({atoutvie_verdict:'classique',atoutvie_manches:'abc'}).c.P.total,10);
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
  c.donneDuJour();assert.equal(c.P.donne,c.graineDuJour().jour);assert.equal(c.P.total,16);assert.equal(c.P.verdict,'equilibre');
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
      assert.ok(nodes.get('app').innerHTML.includes('>NOUS'),'l’en-tête nomme notre équipe');
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

test('jokers : accès permanent en duel et à quatre, même épuisés, ouverture fonctionnelle',()=>{
  for(const mode of ['duel','table4']){
    const {c,nodes}=jeu({atoutvie_mode:mode});
    const entete=()=>nodes.get('app').innerHTML.match(/<div class="msg(?: haute)?">([\s\S]*?)<div class="main/)[1];
    assert.match(entete(),/class="acces-jokers/);
    c.ouvrirTableau();assert.equal(c.tableauOuvert,true);assert.match(nodes.get('app').innerHTML,/TES JOKERS/);
    c.fermerTableau();c.P.jokers[1]=[];c.rendre();assert.match(entete(),/Mes jokers \(0\)/);
    c.ouvrirTableau();assert.match(nodes.get('app').innerHTML,/Tu as utilisé tous tes jokers/);
  }
});

 test('affichage : dimensions fixes selon écran, indépendantes de la main et du tour',()=>{
  for(const mode of ['duel','table4'])for(const [w,h] of [[320,568],[390,844],[430,932],[844,390],[1366,768],[1920,1080],[3840,2160]]){
    const {c}=jeu({atoutvie_mode:mode});c.innerWidth=w;c.innerHeight=h;
    const a=c.dimensionsJeu();assert.ok(a.hauteur>0&&a.largeur>0);
    assert.ok(a.colonnes*a.lignes>=(mode==='table4'?8:10));
    c.P.mains[1].pop();c.etape='poser';const b=c.dimensionsJeu();
    assert.deepEqual(a,b,`zones variables à ${w}×${h}`);
  }
});
test('table à 4 : la voix annonce le Brakeur du gagnant avant toute égalité',()=>{
  const {c}=jeu({atoutvie_mode:'table4'});assert.equal(c.P.mode,'table4');
  const dits=[];c.VOIX={dire:t=>dits.push(t)};
  const pose=(joueur,valeur,joker=null)=>({joueur,pilier:'Santé',valeur,joker});
  const dire=d=>{dits.length=0;c.annoncerVerdict(d);return dits.slice();};
  // Égalité en tête entre Toi et Est, mais le Brakeur de Nord emporte la manche.
  assert.deepEqual(dire({poses:[pose(1,9),pose(2,9),pose(3,2,'j1'),pose(4,1)],gagnant:3,equipe:'nous',bloque:{}}),
    ['Toi 9 de Santé, Est 9 de Santé, Nord 2 de Santé, Ouest 1 de Santé. Le Brakeur de Nord emporte la manche, quelle que soit la carte.']);
  assert.deepEqual(dire({poses:[pose(1,9),pose(2,9),pose(3,2),pose(4,1,'j1')],gagnant:4,equipe:'eux',bloque:{}}),
    ['Toi 9 de Santé, Est 9 de Santé, Nord 2 de Santé, Ouest 1 de Santé. Le Brakeur d’Ouest emporte la manche, quelle que soit la carte.']);
  assert.deepEqual(dire({poses:[pose(1,3,'j1'),pose(2,9),pose(3,9),pose(4,1)],gagnant:1,equipe:'nous',bloque:{}}),
    ['Toi 3 de Santé, Est 9 de Santé, Nord 9 de Santé, Ouest 1 de Santé. Ton Brakeur emporte la manche, quelle que soit la carte.']);
  // Brakeur bloqué : l'égalité reprend sa place.
  assert.deepEqual(dire({poses:[pose(1,9),pose(2,9),pose(3,2,'j1'),pose(4,1)],gagnant:1,equipe:'nous',bloque:{3:true}}),
    ['Toi 9 de Santé, Est 9 de Santé, Nord 2 de Santé, Ouest 1 de Santé. Nord avait joué son Brakeur, bloqué par un Bouclier. Égalité. Tu avais posé en premier, la manche est à toi.']);
  // Sans Brakeur : l'annonce d'égalité inchangée ; sans égalité, à qui va la manche.
  assert.deepEqual(dire({poses:[pose(2,9),pose(1,9),pose(3,2),pose(4,1)],gagnant:2,equipe:'eux',bloque:{}}),
    ['Est 9 de Santé, Toi 9 de Santé, Nord 2 de Santé, Ouest 1 de Santé. Égalité. Est avait posé en premier, la manche est à leur équipe.']);
  assert.deepEqual(dire({poses:[pose(1,9),pose(2,8),pose(3,2),pose(4,1)],gagnant:1,equipe:'nous',bloque:{}}),
    ['Toi 9 de Santé, Est 8 de Santé, Nord 2 de Santé, Ouest 1 de Santé. La manche est à votre équipe.']);
  assert.deepEqual(dire({poses:[pose(2,9),{joueur:1,pilier:'Amour',valeur:0,morte:true},pose(3,2),pose(4,1)],gagnant:2,equipe:'eux',bloque:{}}),
    ['Est 9 de Santé, Toi carte morte, Nord 2 de Santé, Ouest 1 de Santé. La manche est à leur équipe.']);
});
test('la voix : le Brakeur qui décide se dit une seule fois, avec les jokers des autres',()=>{
  const duel=jeu().c;const dits=[];duel.VOIX={dire:t=>dits.push(t)};
  duel.annoncerVerdict({jokers:{1:'j2',2:'j1'},bloque:{},perdu:{},gagnant:2,ouvreur:1,egalite:false});
  assert.deepEqual(dits,['Tu avais joué ton Multiplicateur : la manche compte double. Son Brakeur emporte la manche, quelle que soit la carte.']);
  dits.length=0;duel.annoncerVerdict({jokers:{1:'j1',2:null},bloque:{},perdu:{},gagnant:1,ouvreur:2,egalite:true});
  assert.deepEqual(dits,['Ton Brakeur emporte la manche, quelle que soit la carte.']);
  const t4=jeu({atoutvie_mode:'table4'}).c;const dits4=[];t4.VOIX={dire:t=>dits4.push(t)};
  const pose=(joueur,valeur,joker=null)=>({joueur,pilier:'Santé',valeur,joker});
  t4.annoncerVerdict({poses:[pose(1,9,'j2'),pose(2,9),pose(3,2,'j1'),pose(4,1,'j4')],gagnant:3,equipe:'nous',bloque:{}});
  assert.deepEqual(dits4,['Toi 9 de Santé, Est 9 de Santé, Nord 2 de Santé, Ouest 1 de Santé. Tu avais joué ton Multiplicateur. Ouest avait joué son Bouclier. Le Brakeur de Nord emporte la manche, quelle que soit la carte.']);
});
test('la voix : le Fantôme s’annonce au moment du choix, avant son verdict',()=>{
  const duel=jeu().c,dits=[];duel.VOIX={dire:t=>dits.push(t)};
  const p=duel.P;p.initiative=1;duel.pilJ=null;duel.pilIA=null;duel.planIA=null;duel.etape='pilier';p.jokers[1]=[{id:'j5'}];
  duel.jouerFantomeSur('Santé');
  assert.equal(dits[0],'Fantôme sur Santé');assert.equal(duel.etape,'verdict');
  assert.match(dits[1]||'',/^Ton Fantôme, \d+(\.\d+)? de Santé, contre son \d+ (de |d’)\S+\./);
  assert.doesNotMatch(dits[1],/valait/);
});
test('la voix : rien ne se coupe, un doublon en attente ne se rejoue pas, couper la voix vide la file',()=>{
  const parle=[];let annules=0;
  const synth={getVoices:()=>[],speak:u=>parle.push(u),cancel:()=>{annules++;}};
  const {c}=jeu({},{speechSynthesis:synth,SpeechSynthesisUtterance:function(t){this.text=t;}});
  parle.length=0;c.VOIX.dire('A');c.VOIX.dire('A');c.VOIX.dire('B');
  assert.deepEqual(parle.map(u=>u.text),['A','B']);assert.equal(annules,0);
  parle[0].onend();c.VOIX.dire('A');
  assert.deepEqual(parle.map(u=>u.text),['A','B','A']);assert.equal(annules,0);
  c.basculerVoix();assert.equal(annules,1);
  c.basculerVoix();c.VOIX.dire('B');assert.equal(parle.at(-1).text,'B');
});
test('la voix : les cartes jouées, puis à qui va la manche',()=>{
  const duel=jeu().c,dits=[];duel.VOIX={dire:t=>dits.push(t)};
  const c1={pts:30,pilier:'Amour'},c2={pts:25,pilier:'Santé'};
  duel.annoncerVerdict({c1,c2,jokers:{},bloque:{},perdu:{},gagnant:1,ouvreur:1,egalite:false});
  duel.annoncerVerdict({c1:{pts:20,pilier:'Argent'},c2:{pts:35,pilier:'Spiritualité'},jokers:{},bloque:{},perdu:{},gagnant:2,ouvreur:1,egalite:false});
  duel.annoncerVerdict({c1:{pts:30,pilier:'Santé'},c2:{pts:30,pilier:'Santé'},jokers:{},bloque:{},perdu:{},gagnant:2,ouvreur:2,egalite:true});
  assert.deepEqual(dits,['Ton 30 d’Amour contre son 25 de Santé. La manche est à toi.',
    'Ton 20 d’Argent contre son 35 de Spiritualité. La manche est à elle.',
    'Ton 30 de Santé contre son 30 de Santé. Égalité. Elle avait ouvert, la manche est à elle.']);
});
test('la voix (Classique) : la fin de partie annonce le vainqueur et le score',()=>{
  const dire=(s1,s2)=>{const {c}=jeu({atoutvie_verdict:'classique'}),dits=[];c.VOIX={dire:t=>dits.push(t)};c.P.s1=s1;c.P.s2=s2;c.rendreFin();return dits;};
  assert.deepEqual(dire(120,80),['Tu as gagné la partie, 120 à 80.']);
  assert.deepEqual(dire(60,90),['Elle a gagné la partie, 90 à 60.']);
  assert.deepEqual(dire(70,70),['Partie nulle, 70 partout.']);
});
test('la voix : la valeur du Fantôme se dit dans la phrase des cartes',()=>{
  const duel=jeu().c,dits=[];duel.VOIX={dire:t=>dits.push(t)};
  duel.annoncerVerdict({c1:{pts:35,pilier:'Santé',fantome:true},c2:{pts:30,pilier:'Santé'},jokers:{},bloque:{},perdu:{},gagnant:1,ouvreur:1,egalite:false});
  duel.annoncerVerdict({c1:{pts:30,pilier:'Argent'},c2:{pts:20,pilier:'Argent',fantome:true},jokers:{},bloque:{},perdu:{},gagnant:1,ouvreur:1,egalite:false});
  assert.deepEqual(dits,['Ton Fantôme, 35 de Santé, contre son 30 de Santé. La manche est à toi.',
    'Ton 30 d’Argent contre son Fantôme, 20 d’Argent. La manche est à toi.']);
  const t4=jeu({atoutvie_mode:'table4'}).c,dits4=[];t4.VOIX={dire:t=>dits4.push(t)};
  const pose=(joueur,valeur,fantome)=>({joueur,pilier:'Santé',valeur,carte:{pts:valeur,fantome:!!fantome},joker:null});
  t4.annoncerVerdict({poses:[pose(1,35,true),pose(2,30),pose(3,10),pose(4,5)],gagnant:1,equipe:'nous',bloque:{}});
  assert.deepEqual(dits4,['Toi Fantôme, 35 de Santé, Est 30 de Santé, Nord 10 de Santé, Ouest 5 de Santé. La manche est à votre équipe.']);
});
test('donne du jour : le jour vient de l’horloge UTC (Dakar)',()=>{
  const {c}=jeu();
  assert.equal(c.graineDuJour(new Date(Date.UTC(2026,9,30,23,30))).jour,20261030);
});
test('donne du jour : toujours en duel, en Équilibre, 16 manches, contre la Sage, quels que soient les réglages',()=>{
  const {c}=jeu({atoutvie_mode:'table4',atoutvie_niveau:'apprentie',atoutvie_verdict:'classique',atoutvie_manches:'8'});
  assert.equal(c.P.mode,'table4');
  c.donneDuJour();
  assert.notEqual(c.P.mode,'table4');assert.equal(c.P.total,16);assert.equal(c.P.verdict,'equilibre');assert.equal(c.niveauEffectif(),'sage');
});
test('Fantôme : son joueur ne pioche pas, la pioche ne perd qu’une carte',()=>{
  const {c}=jeu(),p=c.nouvellePartie();p.jokers[1]=[{id:'j5'}];p.initiative=1;
  const avant1=p.mains[1].length,avant2=p.mains[2].length,pioche=p.pioche.length;
  const pil=c.piliersOuvrables(p,1)[0]||'Santé';
  const pil2=c.piliersRepondables(p,2,pil)[0];const c2=p.mains[2].find(x=>x.pilier===pil2);
  c.resoudreManche(p,{pilier1:pil,carte1:'fantome',pilier2:pil2,carte2:c2.id});
  assert.equal(p.mains[1].length,avant1);assert.equal(p.mains[2].length,avant2);assert.equal(p.pioche.length,pioche-1);
});

/* ── Le verdict Équilibre (Lamine, 10 novembre 2026) ──
   Depuis la v23 il n'est plus le défaut ni proposé dans les réglages, mais
   il reste dans le code : ces tests le choisissent explicitement. */
function jeuEq(saved,env){const r=jeu(saved,env);r.c.reglerVerdict('equilibre');r.c.neuf();return r;}
const sim=require('./simuler-equilibre.cjs');
test('scoreEquilibre : la somme des deux piliers les plus faibles',()=>{
  const {c}=jeu();
  assert.equal(c.scoreEquilibre({'Spiritualité':100,'Amour':50,'Santé':30,'Argent':200}),80);
  assert.equal(c.scoreEquilibre([90,10,40,40]),50);
  assert.equal(c.scoreEquilibre({'Spiritualité':300,'Amour':0,'Santé':120,'Argent':200}),120,'un pilier à 0 compte pour 0');
  assert.equal(c.scoreEquilibre({'Amour':500,'Santé':500}),0,'un pilier absent vaut 0');
  assert.equal(c.scoreEquilibre({'Spiritualité':60,'Amour':60,'Santé':60,'Argent':60}),120);
  assert.deepEqual([...c.piliersFaibles({'Spiritualité':60,'Amour':10,'Santé':60,'Argent':10})],['Amour','Argent']);
});
test('Équilibre : points par pilier, pas de bonus, vainqueur au score d’Équilibre puis au total',()=>{
  const {c}=jeu(),p=c.nouvellePartie({verdict:'equilibre'});p.jokers={1:[],2:[]};
  assert.equal(p.verdict,'equilibre');
  // Toi : une manche (45) dans chacun des quatre piliers — en Classique, ce serait +40.
  for(const pil of piliers)assert.equal(manche(c,p,pil).bonus,0);
  assert.equal(p.s1,180);assert.equal(p.bonusEquilibre[1],false);
  // Elle : 3 × 45 sur Santé, rien ailleurs → total 135, Équilibre 0.
  for(let i=0;i<3;i++)manche(c,p,'Santé',{},2);
  let B=c.bilanPartie(p);
  assert.deepEqual([B.equilibre[1],B.equilibre[2],B.total[1],B.total[2]],[90,0,180,135]);
  assert.equal(B.gagnant,1);assert.equal(B.niveau,'equilibre');
  // Le Multiplicateur compte dans son pilier.
  p.jokers[2]=[{id:'j2'}];manche(c,p,'Amour',{joker2:'j2'},2);
  assert.equal(c.totauxParPilier(p,2)['Amour'],90);
});
test('Équilibre : égalité sur l’Équilibre → le total ; égalité encore → partie nulle',()=>{
  const {c}=jeu(),p=c.nouvellePartie({verdict:'equilibre'});p.jokers={1:[],2:[]};
  for(const pil of piliers){manche(c,p,pil);manche(c,p,pil,{},2);}            // 45 partout, chacun
  manche(c,p,'Santé');                                                         // Toi : Santé 90, total plus haut
  let B=c.bilanPartie(p);assert.equal(B.equilibre[1],B.equilibre[2]);assert.equal(B.niveau,'total');assert.equal(B.gagnant,1);
  manche(c,p,'Santé',{},2);B=c.bilanPartie(p);
  assert.equal(B.gagnant,null);assert.equal(B.niveau,'nul');
});
test('Classique inchangé : sans réglage, la partie est Classique, avec son bonus et son total',()=>{
  const {c}=jeu(),p=c.nouvellePartie();p.jokers={1:[],2:[]};
  assert.equal(p.verdict,'classique');assert.equal(p.total,10);
  let r;for(const pil of piliers)r=manche(c,p,pil);
  assert.equal(r.bonus,40);assert.equal(p.s1,4*45+40);
  manche(c,p,'Santé',{},2);const B=c.bilanPartie(p);assert.equal(B.niveau,'total');assert.equal(B.principal[1],220);
});
test('Équilibre : 16 manches par défaut, le paquet entier se joue',()=>{
  const {c}=jeuEq();assert.equal(c.verdictJeu,'equilibre');assert.equal(c.P.verdict,'equilibre');assert.equal(c.P.total,16);
  const s=sim.charger();
  for(let g=0;g<60;g++){
    sim.partie(s,'sage','apprentie',777+g,g%2===0);const P=s.P;
    assert.equal(P.historique.length,16);assert.equal(P.pioche.length,0);
    const enMain=[...P.mains[1],...P.mains[2]],posees=Object.values(P.plis).flat().filter(x=>!x.fantome);
    assert.equal(posees.length+enMain.length,32);
    // Seul le Fantôme, joué à la place d'une carte, peut laisser une carte en main.
    assert.equal(enMain.length,Object.values(P.plis).flat().filter(x=>x.fantome).length);
  }
});
test('réglage du verdict : mémorisé, sans toucher la partie en cours ; une durée par verdict',()=>{
  const {c,saved}=jeuEq();assert.equal(c.P.verdict,'equilibre');
  c.reglerVerdict('classique');assert.equal(saved.atoutvie_verdict,'classique');assert.equal(c.P.verdict,'equilibre');assert.equal(c.manchesSuivantes,10);
  c.ouvrirReglages();assert.match(c.reglagesHTML(),/reste en Équilibre/);
  c.neuf();assert.equal(c.P.verdict,'classique');assert.equal(c.P.total,10);
  c.reglerVerdict('equilibre');c.reglerManches(10);assert.equal(saved.atoutvie_manches_equilibre,'10');
  delete saved.atoutvie_partie;   // pas de reprise : une partie neuve
  // v23 : Équilibre n'est plus proposé — mémorisé, il redevient Piliers au démarrage.
  const r=jeu(saved);assert.equal(r.c.P.verdict,'piliers');assert.equal(r.c.verdictJeu,'piliers');
});
test('table à 4 en Équilibre : par équipe, la prime de contestation va au pilier contesté, pas de bonus',()=>{
  const {c}=jeu();const p=c.nouvelleTable4({rnd:seed4(9),verdict:'equilibre'});p.ouvreur=1;p.jokers={1:[],2:[],3:[],4:[]};
  const carte=(id,pil,pts)=>({id,pilier:pil,pts,nom:'T',cit:''});
  // Est conteste la Santé de Toi avec un 50 : la manche (Santé, 105) et la prime (Santé, 90) vont à EUX.
  p.mains={1:[carte('a','Santé',40)],2:[carte('b','Santé',50),carte('b2','Amour',5)],3:[carte('c','Argent',10)],4:[carte('d','Spiritualité',5)]};
  c.resoudreManche4(p,[{joueur:1,pilier:'Santé',carte:'a'},{joueur:2,pilier:'Santé',carte:'b'},{joueur:3,pilier:'Argent',carte:'c'},{joueur:4,pilier:'Spiritualité',carte:'d'}]);
  assert.equal(c.totauxParPilier(p,'eux')['Santé'],195);assert.equal(c.totauxParPilier(p,'nous')['Santé'],0);
  p.piliersGagnes.nous=['Santé','Amour','Argent'];
  p.mains={1:[carte('m','Spiritualité',50)],2:[carte('n','Amour',5)],3:[carte('o','Argent',5)],4:[carte('q','Santé',5)]};
  const h=c.resoudreManche4(p,[{joueur:2,pilier:'Amour',carte:'n'},{joueur:3,pilier:'Argent',carte:'o'},{joueur:4,pilier:'Santé',carte:'q'},{joueur:1,pilier:'Spiritualité',carte:'m'}]);
  assert.equal(h.bonus,0);
  const B=c.bilanPartie(p);assert.deepEqual([...B.camps],['nous','eux']);assert.equal(B.totaux.nous['Spiritualité'],65);assert.equal(B.equilibre.nous,0);
  assert.equal(B.total.eux,195);assert.equal(B.gagnant,'eux');assert.equal(B.niveau,'total');
});
test('table à 4 en Équilibre : l’IA ne lit que sa main, 100 parties cohérentes',()=>{
  const {c}=jeu();const rnd=seed4(11);
  for(let i=0;i<100;i++){const p=c.nouvelleTable4({rnd,verdict:'equilibre'});
    while(!c.finie(p)){const coups=[];
      for(const j of c.ordreManche4(p)){const autres=[1,2,3,4].filter(x=>x!==j),mains=p.mains,jokers=p.jokers;
        p.mains=new Proxy(mains,{get(t,k){if(autres.includes(+k))throw Error('main '+k+' consultée par '+j);return t[k];}});
        p.jokers=new Proxy(jokers,{get(t,k){if(autres.includes(+k))throw Error('jokers '+k+' consultés par '+j);return t[k];}});
        const d=c.ia4(p,j,coups);p.mains=mains;p.jokers=jokers;coups.push({joueur:j,pilier:d.pilier,carte:d.carte.id,joker:d.joker});}
      c.resoudreManche4(p,coups);}
    const B=c.bilanPartie(p);
    for(const e of ['nous','eux'])assert.equal(Object.values(B.totaux[e]).reduce((a,b)=>a+b,0),p.scores[e]);
    assert.ok(p.historique.every(h=>h.bonus===0));
  }
});
test('donne du jour en Équilibre : la même graine, la même partie pour tout le monde',()=>{
  const a=jeu({atoutvie_verdict:'classique',atoutvie_manches:'8',atoutvie_mode:'table4'}).c,b=jeu({atoutvie_manches_equilibre:'10'}).c;
  a.donneDuJour();b.donneDuJour();
  for(const x of [a,b]){assert.equal(x.P.verdict,'equilibre');assert.equal(x.P.total,16);assert.equal(x.P.mode,undefined);}
  assert.equal(a.P.mains[1].map(x=>x.id).join(),b.P.mains[1].map(x=>x.id).join());
  assert.equal(a.P.pioche.map(x=>x.id).join(),b.P.pioche.map(x=>x.id).join());
  assert.equal(JSON.stringify(a.P.jokers),JSON.stringify(b.P.jokers));
});
test('IA en Équilibre : l’Apprentie vise ses deux piliers les plus faibles',()=>{
  const {c}=jeu();const p=c.nouvellePartie({verdict:'equilibre'});c.P=p;p.jokers={1:[],2:[]};
  for(const pil of ['Santé','Argent'])manche(c,p,pil,{},2);   // elle a Santé et Argent ; Spiritualité et Amour à 0
  p.mains[2]=[carte('s','Santé',30),carte('a','Amour',20)];p.initiative=2;
  assert.equal(c.iaChoisit(null).carte.id,'a','20 d’Amour (faible, +14) avant 30 de Santé');
  p.verdict='classique';p.piliersGagnes[2]=[];
  assert.equal(c.iaChoisit(null).carte.id,'s','en Classique, rien ne change : la plus forte');
});
test('la voix en Équilibre : piliers conquis, deux faibles au verdict, égalité dite',()=>{
  const {c}=jeuEq(),dits=[];c.VOIX={dire:t=>dits.push(t)};const p=c.P;p.jokers={1:[],2:[]};
  c.annoncerVerdict(manche(c,p,'Amour'));assert.match(dits.at(-1),/La manche est à toi\. Amour conquis\.$/);
  c.annoncerVerdict(manche(c,p,'Amour'));assert.doesNotMatch(dits.at(-1),/conquis/,'déjà conquis : rien');
  c.annoncerVerdict(manche(c,p,'Santé'));assert.match(dits.at(-1),/Santé conquise\.$/);
  c.annoncerVerdict(manche(c,p,'Argent',{},2));assert.doesNotMatch(dits.at(-1),/conquis/,'ses conquêtes à elle ne se disent pas');
  const B={verdict:'equilibre',camps:[1,2],totaux:{1:{'Spiritualité':120,'Amour':60,'Santé':75,'Argent':200},2:{'Spiritualité':150,'Amour':90,'Santé':130,'Argent':40}},
    faibles:{1:['Amour','Santé'],2:['Argent','Amour']},equilibre:{1:135,2:130},total:{1:455,2:410},gagnant:1,niveau:'equilibre'};
  assert.equal(c.phraseVerdict(B),'Tes deux piliers faibles : Amour 60, Santé 75. Les siens : Argent 40, Amour 90. La partie est à toi.');
  assert.equal(c.phraseVerdict({...B,equilibre:{1:130,2:130},niveau:'total'}),
    'Tes deux piliers faibles : Amour 60, Santé 75. Les siens : Argent 40, Amour 90. Égalité sur l’Équilibre, le total décide : 455 contre 410. La partie est à toi.');
  assert.equal(c.phraseVerdict({...B,camps:['nous','eux'],totaux:{nous:B.totaux[1],eux:B.totaux[2]},faibles:{nous:B.faibles[1],eux:B.faibles[2]},gagnant:'eux'}),
    'Nos deux piliers faibles : Amour 60, Santé 75. Les leurs : Argent 40, Amour 90. La partie est à eux.');
  dits.length=0;c.rendreFin();assert.match(dits[0],/^Tes deux piliers faibles : /);
});
test('trophées : les 40 et 50 adverses capturés, Fantôme et carte du partenaire exclus',()=>{
  const {c}=jeu(),p=c.nouvellePartie({verdict:'equilibre'});p.jokers={1:[],2:[]};p.pioche=[];
  const coup=(a,b,o={})=>{p.mains={1:[a],2:[b]};return c.resoudreManche(p,{pilier1:a.pilier,carte1:a.id,pilier2:b.pilier,carte2:b.id,...o});};
  coup(carte('x1','Santé',50),carte('y1','Amour',50));            // Toi ouvres, égalité : son 50 d'Amour est à toi
  coup(carte('x2','Santé',10),carte('y2','Argent',40));           // elle ouvre et gagne : ton 10 n'est pas un trophée
  coup(carte('x3','Amour',40),carte('y3','Argent',50));           // Toi ouvres, elle gagne : ton 40 d'Amour est à elle
  const t1=c.trophees(p,1),t2=c.trophees(p,2);
  assert.deepEqual([...t1].map(t=>t.pts+' '+t.pilier),['50 Amour']);
  assert.deepEqual([...t2].map(t=>t.pts+' '+t.pilier),['40 Amour']);
  // À 4 : la carte du partenaire ne compte pas.
  const q=c.nouvelleTable4({rnd:seed4(3),verdict:'equilibre'});q.ouvreur=1;q.jokers={1:[],2:[],3:[],4:[]};
  q.mains={1:[carte('a','Santé',50)],2:[carte('b','Amour',40)],3:[carte('d','Argent',50)],4:[carte('e','Spiritualité',5)]};
  c.resoudreManche4(q,[{joueur:1,pilier:'Santé',carte:'a'},{joueur:2,pilier:'Amour',carte:'b'},{joueur:3,pilier:'Argent',carte:'d'},{joueur:4,pilier:'Spiritualité',carte:'e'}]);
  assert.deepEqual([...c.trophees(q,'nous')].map(t=>t.pts+' '+t.pilier),['40 Amour']);
});
test('trophées : la vitrine tient dans l’en-tête, repliée en compteur quand la place manque',()=>{
  const {c,nodes}=jeuEq();const P=c.P;
  const prise=(pts,pil,m)=>({id:'t'+m,pilier:pil,pts,nom:'T',cit:'',par:2,gagnePar:1,morte:true,manche:m});
  P.plis['Amour'].push(prise(50,'Amour',1),prise(40,'Santé',2));c.rendre();
  let h=nodes.get('app').innerHTML;
  assert.match(h,/class="tro or"[^>]*><i class="e-amo"><\/i>50<\/span><span class="tro"[^>]*><i class="e-san"><\/i>40/);
  P.plis['Argent'].push(prise(50,'Argent',3),prise(50,'Spiritualité',4));c.rendre();h=nodes.get('app').innerHTML;
  assert.match(h,/<button class="vitrine tro-cpt" onclick="voirTrophees\('1'\)"><b>50<\/b> ×3 · 40 ×1<\/button>/,'à 390 px, quatre trophées se replient');
  c.innerWidth=1366;c.rendre();assert.doesNotMatch(nodes.get('app').innerHTML,/tro-cpt/,'sur grand écran, ils tiennent');
  c.verdictJeu='classique';c.neuf();c.P.plis['Amour'].push(prise(50,'Amour',1));c.rendre();
  assert.doesNotMatch(nodes.get('app').innerHTML,/vitrine/,'Classique : en-tête inchangé');
});
test('trophées : la voix les dit au verdict, après le reste',()=>{
  const {c}=jeuEq(),dits=[];c.VOIX={dire:t=>dits.push(t)};
  c.annoncerVerdict({c1:{pts:30,pilier:'Santé'},c2:{pts:50,pilier:'Amour'},jokers:{2:'j1'},bloque:{2:true},perdu:{},gagnant:1,ouvreur:1,egalite:false});
  assert.match(dits.at(-1),/La manche est à toi\. Tu lui prends son 50 d’Amour\.$/);
  c.annoncerVerdict({c1:{pts:40,pilier:'Santé'},c2:{pts:50,pilier:'Argent'},jokers:{},bloque:{},perdu:{},gagnant:2,ouvreur:1,egalite:false});
  assert.equal(dits.at(-1),'Ton 40 de Santé contre son 50 d’Argent. La manche est à elle. Elle te prend ton 40 de Santé.');
  c.annoncerVerdict({c1:{pts:30,pilier:'Santé',fantome:true},c2:{pts:20,pilier:'Amour'},jokers:{},bloque:{},perdu:{},gagnant:2,ouvreur:1,egalite:false});
  assert.doesNotMatch(dits.at(-1),/prend/);
  const t4=jeuEq({atoutvie_mode:'table4'}).c,d4=[];t4.VOIX={dire:t=>d4.push(t)};
  const pose=(joueur,pts,pilier)=>({joueur,pilier,valeur:pts,carte:{pts,pilier},joker:null});
  t4.annoncerVerdict({poses:[pose(1,50,'Santé'),pose(2,40,'Amour'),pose(3,10,'Argent'),pose(4,50,'Spiritualité')],gagnant:1,equipe:'nous',bloque:{}});
  assert.match(d4.at(-1),/Votre équipe prend le 40 d’Amour d’Est\. Votre équipe prend le 50 de Spiritualité d’Ouest\.$/);
  t4.annoncerVerdict({poses:[pose(1,40,'Santé'),pose(2,50,'Amour'),pose(3,50,'Argent'),pose(4,10,'Spiritualité')],gagnant:2,equipe:'eux',bloque:{}});
  assert.match(d4.at(-1),/Leur équipe te prend ton 40 de Santé\. Leur équipe prend le 50 d’Argent de Nord\.$/);
});
test('palmarès : 50 capturés en carrière et record d’une partie',()=>{
  const {c,nodes,saved}=jeu();
  const plis=n=>({'Amour':Array.from({length:n},(_,i)=>({pts:50,pilier:'Amour',par:2,gagnePar:1})).concat([{pts:50,pilier:'Santé',par:1,gagnePar:1},{pts:50,pilier:'Argent',par:2,gagnePar:2,fantome:true}])});
  c.STATS.finPartie(10,5,plis(2),1);c.STATS.finPartie(10,5,plis(1),1);
  assert.equal(c.STATS.etat().cinquante,3);assert.equal(c.STATS.etat().recordCinquante,2);
  c.palmaresOuvert=true;c.rendre();assert.match(nodes.get('app').innerHTML,/50 capturés en carrière<\/span><b>3/);assert.match(nodes.get('app').innerHTML,/Record de 50 en une partie<\/span><b>2/);
  assert.equal(JSON.parse(saved.galgal_stats).cinquante,3,'gardé dans le téléphone');
});
/* ── Départage (point 9) : Équilibre, total, 50 capturés, 40 capturés, nulle ── */
function partieFaite(c,{h1=[],h2=[],t1=[],t2=[],mode}={}){
  const plis={'Spiritualité':[],'Amour':[],'Santé':[],'Argent':[]};
  const [A,Bc]=mode==='table4'?['nous','eux']:[1,2],adv={1:2,2:1,nous:2,eux:1};
  const historique=[...h1.map(([pil,b])=>({gagnant:1,equipe:A,pilierGagnant:pil,butin:b})),...h2.map(([pil,b])=>({gagnant:2,equipe:Bc,pilierGagnant:pil,butin:b}))];
  t1.forEach((v,i)=>plis['Amour'].push({pts:v,pilier:'Amour',par:adv[A],gagnePar:A,manche:i+1}));
  t2.forEach((v,i)=>plis['Santé'].push({pts:v,pilier:'Santé',par:mode==='table4'?1:1,gagnePar:Bc,manche:i+1}));
  const tot=h=>h.reduce((s,x)=>s+x[1],0);
  return mode==='table4'?{mode,verdict:'equilibre',historique,plis,scores:{nous:tot(h1),eux:tot(h2)}}:{verdict:'equilibre',historique,plis,s1:tot(h1),s2:tot(h2)};
}
test('départage, niveau par niveau : Équilibre, total, 50, 40, puis partie nulle',()=>{
  const {c}=jeu();const v=o=>{const B=c.bilanPartie(partieFaite(c,o));return [B.niveau,B.gagnant];};
  const q=b=>[['Spiritualité',b],['Amour',b],['Santé',b],['Argent',b]];
  assert.deepEqual(v({h1:q(50),h2:q(40)}),['equilibre',1]);
  assert.deepEqual(v({h1:[...q(50),['Santé',30]],h2:[...q(50),['Amour',10]]}),['total',1]);
  assert.deepEqual(v({h1:q(50),h2:q(50),t1:[50],t2:[50,50]}),['cinquante',2]);
  assert.deepEqual(v({h1:q(50),h2:q(50),t1:[50,40,40],t2:[50,40]}),['quarante',1]);
  assert.deepEqual(v({h1:q(50),h2:q(50),t1:[50,40],t2:[40,50]}),['nul',null]);
  assert.deepEqual(v({mode:'table4',h1:q(50),h2:q(50),t1:[50,50],t2:[50]}),['cinquante','nous'],'à 4, par équipe');
  // Classique : seul le total compte, les trophées ne départagent pas.
  const cl=c.bilanPartie({...partieFaite(c,{h1:q(50),h2:q(50),t1:[50]}),verdict:'classique'});
  assert.deepEqual([cl.niveau,cl.gagnant],['nul',null]);
});
test('départage : la voix dit le niveau utilisé',()=>{
  const {c}=jeu();const dire=o=>c.phraseVerdict(c.bilanPartie(partieFaite(c,o)));
  const q=b=>[['Spiritualité',b],['Amour',b],['Santé',b],['Argent',b]];
  assert.match(dire({h1:q(50),h2:q(50),t1:[50,50],t2:[50]}),/ Égalité sur l’Équilibre et le total : tu as pris plus de 50, la partie est à toi\.$/);
  assert.match(dire({h1:q(50),h2:q(50),t2:[50]}),/ Égalité sur l’Équilibre et le total : elle a pris plus de 50, la partie est à elle\.$/);
  assert.match(dire({h1:q(50),h2:q(50),t1:[40],t2:[]}),/ Égalité sur l’Équilibre, le total et les 50 : tu as pris plus de 40, la partie est à toi\.$/);
  assert.match(dire({h1:q(50),h2:q(50)}),/ Égalité sur l’Équilibre, le total, les 50 et les 40 : partie nulle\.$/);
  assert.match(dire({mode:'table4',h1:q(50),h2:q(50),t2:[40]}),/^Nos deux piliers faibles : .* Égalité sur l’Équilibre, le total et les 50 : ils ont pris plus de 40, la partie est à eux\.$/);
  assert.match(dire({h1:[...q(50),['Santé',30]],h2:q(50)}),/Égalité sur l’Équilibre, le total décide : 230 contre 200\. La partie est à toi\.$/);
});
