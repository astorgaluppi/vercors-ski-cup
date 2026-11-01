# Pas Très Pentu Ski Cup — V2

Petit jeu de ski en famille, jouable dans le navigateur d'un téléphone (portrait) ou d'un ordinateur.

## Jouer
- Téléphone : poser le pouce n'importe où et glisser (gauche / droite pour tourner, bas pour le schuss, haut pour le chasse-neige).
- Ordinateur : flèches du clavier (Entrée ou Espace pour « Jouer » / « Rejouer »).

## Contenu
Piste de 1 500 m avec sapins du bord et deux champs de bosses (300 m et 1 000 m), compte à rebours,
chrono au dixième, vitesse en km/h, temps intermédiaires à 500 m et 1 000 m, arrivée avec aire d'arrêt,
« Chute ! » et « Hors délai » (2 min).

Nouveautés de la V2 :
- **Classement de la famille** : chaque joueur saisit son prénom (et une fois le code famille) sur l'écran d'accueil.
  Le record de la famille s'affiche au départ, les écarts s'affichent aux temps intermédiaires et à l'arrivée,
  et l'écran des résultats donne la place dans la famille. Sans réseau, le jeu marche quand même et le temps
  est envoyé à la descente suivante.
- **Bruitages**, tous fabriqués par le jeu (0 Ko de fichiers son) : glisse qui suit la vitesse, crissement des carres
  dans les virages et en chasse-neige, bips du compte à rebours, cloches de vache plus nombreuses près de l'arrivée,
  murmure de la foule, ovation à l'arrivée, chute avec le « Oh ! » de la foule. Bouton 🔊 pour couper le son.
- **Obstacles** : deux chasse-neige garés en chicane très large au départ (échauffement), et
  « La soupe et les cailloux ! » sur les 300 derniers mètres : neige lourde un peu jaune (virages plus larges,
  vitesse un peu plus basse) et plaques de terre à contourner.

## Fichiers
- `index.html` : la page et les écrans
- `js/config.js` : adresse et clé publique de la base des scores (Supabase)
- `js/piste.js` : le fichier de tronçons (tracé de la piste, champs de bosses, chasse-neige, plaques de terre)
- `js/game.js` : le jeu (physique, dessins, commandes) ; réglages en haut du fichier (`CFG`)
- `js/sons.js` : les bruitages (Web Audio)
- `js/famille.js` : prénom, code famille et classement
- `supabase/scores.sql` : script à lancer une fois dans Supabase (SQL Editor) pour créer la base des scores
- `manifest.webmanifest`, `sw.js`, `icons/` : installation sur l'écran d'accueil et jeu hors connexion

## Publier sur GitHub Pages
Déposer tous ces fichiers à la racine d'un dépôt, puis Settings → Pages → « Deploy from a branch » → `main` / racine.
