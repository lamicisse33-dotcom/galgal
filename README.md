# ATOUT VIE

Jeu de cartes KHALAM. Quatre piliers — Spiritualité, Amour, Santé, Argent.
Chacun ouvre un pilier, pose une carte, la plus forte emporte le pli.

## Déposer sur GitHub Pages

1. Sur GitHub : **New repository**, nom `galgal`, **Public**, sans README.
2. Déposer le contenu de ce dossier **à la racine** du dépôt — pas dans un
   sous-dossier, sinon les chemins relatifs se décalent.
3. **Settings → Pages** → Source : `Deploy from a branch`, branche `main`,
   dossier `/ (root)`. Enregistrer.
4. Attendre deux à trois minutes, puis ouvrir l'adresse fournie.

Le domaine `galgal.khalam.app` se branche ensuite dans **Settings → Pages →
Custom domain**, avec un enregistrement CNAME chez ton hébergeur pointant sur
`<ton-compte>.github.io`.

## À chaque nouvelle version

**Changer `VERSION` dans `sw.js`** — par exemple `atout-vie-v11` (la version déposée le 30 octobre 2026 au soir est `atout-vie-v11`).

Sans ce changement, les joueurs gardent l'ancien jeu en cache et ne verront
jamais la mise à jour. C'est l'erreur la plus fréquente et la plus silencieuse.

Ensuite, la mise à jour est proposée dans les paramètres ⚙️. Le joueur
choisit quand l'appliquer ; on ne recharge jamais quelqu'un en pleine partie.

## Règles et vérification

L'aide « Comment jouer » se trouve dans les paramètres. Le bouclier couvre
la manche d'activation et la suivante. Chaque joueur gagne un bonus unique
de 40 points après avoir remporté une manche dans chacun des quatre piliers.
Ce bonus n'est pas multiplié. L'ordinateur peut utiliser les quatre jokers,
sans consulter la main adverse. La durée choisie (8, 10, 12 ou 16 manches)
est conservée pour les parties suivantes ; elle ne modifie pas la partie en cours.

Deux adversaires : l'**Apprentie** joue sa plus forte carte ; la **Sage** compte
les cartes posées, estime ce qui reste dans la main adverse et sacrifie ses
faibles quand la manche est perdue (66 % de victoires contre l'Apprentie sur
4 000 parties simulées). Ni l'une ni l'autre ne lit la main du joueur — un
test le garantit.

La **donne du jour** (⚙️) distribue la même main à tout le monde, contre la
Sage, en 10 manches ; le résultat se partage depuis l'écran de fin. Une
partie interrompue (appel, rechargement) **reprend à la même manche**. La
citation de la carte gagnante s'affiche à chaque verdict. Le joueur a son
palmarès dans ⚙️ ; le tableau de bord complet reste derrière le code maître
(appui long sur le titre).

## La table à 4

Dans ⚙️, **Mode de jeu : Table à 4**. Toi et Nord (ton partenaire) contre
Est et Ouest, tenus par la Sage. 8 cartes chacun, pas de pioche, 8 manches,
un joker chacun. L'ouvreur — tiré au sort à la première manche, puis à tour
de rôle — pose face cachée ; chacun prend ensuite un pilier encore libre.
La plus forte des quatre cartes gagne la somme des quatre pour son équipe.

**Contester** : au lieu d'un pilier libre, on prend le pilier d'un
adversaire (jamais celui du partenaire) et on pose dessus. Le jeu ne vérifie
pas la carte : c'est le bluff. En fin de manche, la plus forte des deux
cartes du pilier contesté gagne leur somme, en plus du pot. Une carte posée
sur un pilier qui n'est pas le sien vaut 0 — dans la manche comme dans la
contestation. C'est aussi la seule issue quand on n'a aucune carte d'un
pilier libre. Le Bouclier protège les deux coéquipiers.

Points tranchés le 30 octobre 2026 (marqués « TRANCHÉ » dans le code, pour
en rediscuter) : 8 cartes sans pioche ; la carte morte vaut 0 ; un pilier ne
se conteste qu'une fois ; premier ouvreur tiré au sort (sinon ton équipe
gagnait 58 % des parties simulées ; tiré au sort, 51 %).

Exécuter les tests de règles et les simulations avec :

```sh
node --test tests/regles.test.cjs
```

Les tests utilisent un DOM simulé et ne remplacent pas une vérification visuelle.

## Installation sur téléphone

- **Android** : le navigateur propose « Installer l'application ».
- **iPhone** : Partager → « Sur l'écran d'accueil ».

L'installation ne fonctionne **que depuis une adresse en HTTPS**. Un fichier
ouvert localement ne peut pas s'installer : un service worker refuse de
démarrer depuis `file://`.

## Le contenu

| Fichier | Rôle |
|---|---|
| `index.html` | le jeu entier, autonome |
| `sw.js` | hors ligne et mises à jour — **changer `VERSION` à chaque dépôt** |
| `manifest.json` | nom, icônes, couleurs, plein écran |
| `icon-192.png`, `icon-512.png` | icônes d'application |
| `apple-touch-icon.png` | icône iPhone |

© 2026 KHALAM (Khadi & Lamine). Tous droits réservés.

