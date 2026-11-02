# Pas Très Pentu Ski Cup — V3

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
- **Bruitages**, tous fabriqués par le jeu (0 Ko de fichiers son) : glisse douce de poudreuse qui suit la vitesse,
  plus forte dans les virages et en chasse-neige, bips du compte à rebours, bip de recul des chasse-neige,
  ovation à l'arrivée (applaudissements, brouhaha et cloches de vache), chute avec le « Oh ! » de la foule. Bouton 🔊 pour couper le son.
- **Obstacles** : deux chasse-neige garés en chicane très large au départ (échauffement), et
  « La soupe et les cailloux ! » sur les 200 derniers mètres : neige lourde un peu jaune (virages plus larges,
  vitesse un peu plus basse) et plaques de terre à contourner.

Nouveautés de la V3 :
- **Choix des skis** juste avant la course : « Tante Rhéa » (75 km/h, chasse-neige jusqu'à 5 km/h, virages +30 %),
  « Madame Bec » (réglages de la V2, présélectionnée) et « Père Fourcade » (100 km/h, 15 km/h, virages −20 %).
  « Rejouer » repart avec la même paire ; la paire du record s'affiche dans le classement.
- **École de ski** (« Le moniteur de ski ! », vers 400 m) : un moniteur en rouge suivi de 8 enfants descend en
  zigzag d'un bord à l'autre à 8 km/h ; toucher l'un des 9 skieurs fait tomber.
- **Champs de bosses en passages** : rangées serrées avec une seule ouverture qui change de côté à chaque rangée,
  impossible de passer tout droit.
- Arrivée : traces figées, arrêt dans le bas de l'aire d'arrivée, bras levés une fois arrêté. Bruitages plus doux.

## Fichiers
- `index.html` : la page et les écrans
- `js/config.js` : adresse et clé publique de la base des scores (Supabase)
- `js/piste.js` : le fichier de tronçons (tracé de la piste, champs de bosses, chasse-neige, école de ski, plaques de terre)
- `js/game.js` : le jeu (physique, dessins, commandes) ; réglages en haut du fichier (`CFG`)
- `js/sons.js` : les bruitages (Web Audio)
- `js/famille.js` : prénom, code famille et classement
- `supabase/scores.sql` : script à lancer une fois dans Supabase (SQL Editor) pour créer la base des scores
- `supabase/v3-skis.sql` : mise à jour V3 de la base (enregistre la paire de skis du record), sans rien effacer
- `manifest.webmanifest`, `sw.js`, `icons/` : installation sur l'écran d'accueil et jeu hors connexion

## Publier sur GitHub Pages
Déposer tous ces fichiers à la racine d'un dépôt, puis Settings → Pages → « Deploy from a branch » → `main` / racine.
