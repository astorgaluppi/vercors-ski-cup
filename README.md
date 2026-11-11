# Pas Très Pentu Ski Cup — V4

Petit jeu de ski en famille, jouable dans le navigateur d'un téléphone (portrait) ou d'un ordinateur.

## Jouer
- Téléphone : poser le pouce n'importe où et glisser (gauche / droite pour tourner, bas pour le schuss, haut pour le chasse-neige).
- Ordinateur : flèches du clavier (Entrée ou Espace pour « Jouer » / « Rejouer »).

## Contenu
Piste de 1 500 m avec sapins du bord et deux champs de bosses (200 m et 1 180 m depuis la V4.1), compte à rebours,
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
  « La soupe et les cailloux ! » sur les 120 derniers mètres depuis la V4.1 (9 plaques) : neige lourde un peu jaune (virages plus larges,
  vitesse un peu plus basse) et plaques de terre à contourner.

Nouveautés de la V3 :
- **Choix des skis** juste avant la course : « Les Tante Rhéa » (75 km/h, chasse-neige jusqu'à 5 km/h, virages +30 %),
  « Les Madame Bec » (réglages de la V2, présélectionnée) et « Les Neige d'en Haut » (100 km/h, 15 km/h, virages −20 %).
  « Rejouer » repart avec la même paire ; la paire du record s'affiche dans le classement.
- **École de ski** (« Le moniteur de ski ! », vers 815 m) : un moniteur en rouge suivi de 6 enfants descend en
  zigzag d'un bord à l'autre à 8 km/h ; toucher l’un des 7 skieurs (zone de contact un peu plus large que le dessin) fait tomber.
- **Champs de bosses en passages** : rangées serrées avec une seule ouverture qui change de côté à chaque rangée,
  impossible de passer tout droit.
- **Page d'accueil** : logo du jeu, podium des 3 meilleurs temps de la famille (or, argent, bronze), ombre chinoise
  du Vercors en fond, fond sonore fabriqué par le jeu (au premier toucher, coupé au départ ou avec 🔊 ; vent dans la montagne depuis la V4.1) et,
  sur les grands écrans, une bande où le skieur remonte au tire-fesses.
- Arrivée : traces figées, arrêt dans le bas de l'aire d'arrivée, bras levés une fois arrêté. Bruitages plus doux.

Nouveautés de la V4 : les derniers obstacles
- **Canons à neige** (« Canons à neige ! », vers 365 m, au début du secteur en diagonale) : quatre canons au bord
  de la piste se mettent en marche à l'approche du skieur et soufflent pendant 6,5 s. Un nuage de neige couvre l'écran
  et ne laisse voir qu'environ 30 % de la piste et du skieur. Rien ne fait tomber en soi, mais sapins et virage
  deviennent difficiles à voir, et trois bosses isolées se cachent dans le nuage (V4.1). On entend le souffle des canons.
- **Le biathlète** (« Martin Fourcade ! », vers 615 m depuis la V4.1, dans le long secteur vide, avant l'entrée du futur passage secret) :
  en combinaison noire et jaune, carabine dans le dos, il remonte la piste à contresens en pas de patineur (11 km/h).
  Tant qu'il est devant le joueur, il se décale vers lui pour lui foncer dessus : il faut l'esquiver au dernier moment.
  On entend ses pas et son souffle. Le toucher fait tomber.
- **Les Frères Lhuillier** (« Les frères Lhuillier ! », vers 1 000 m, avant le 2e champ de bosses) : deux frères en
  treillis sortent des sapins, un de chaque côté, et lancent des sacs de pièces d'or là où va le skieur. Une cible
  apparaît au sol 1 s avant la chute du sac ; être dedans à ce moment fait tomber. Le sac éclate en gerbe de pièces
  d'or qui restent sur la neige.
- V4.1 : sur la page d'accueil, la musique est remplacée par le vent dans la montagne (rafales et sifflements aigus) ; skis renommés « Les Tante Rhéa », « Les Madame Bec » et « Les Neige d'en Haut » ; l'écran de chute indique la cause et les skis.
- V4.1 : les banderoles d'annonce arrivent environ 1,5 s avant que l'obstacle entre dans l'écran.
- Rappel V3.4 : 2e champ de bosses à 1 100 m ; Les Neige d'en Haut (ex-Père Fourcade) avec la faute de carre « Rebond », qui n'est plus annoncée sur l'écran de choix (V4.1).

## Fichiers
- `index.html` : la page et les écrans
- `js/config.js` : adresse et clé publique de la base des scores (Supabase)
- `js/piste.js` : le fichier de tronçons (tracé de la piste, champs de bosses, chasse-neige, canons à neige, biathlète, école de ski, Frères Lhuillier, plaques de terre)
- `js/game.js` : le jeu (physique, dessins, commandes) ; réglages en haut du fichier (`CFG`)
- `js/sons.js` : les bruitages (Web Audio)
- `js/famille.js` : prénom, code famille, classement et podium
- `js/accueil.js` : page d'accueil (son du vent au premier toucher, bande du tire-fesses)
- `img/logo-titre.png` : le logo (fond rendu transparent)
- `supabase/scores.sql` : script à lancer une fois dans Supabase (SQL Editor) pour créer la base des scores
- `supabase/v3-skis.sql` : mise à jour V3 de la base (enregistre la paire de skis du record), sans rien effacer
- `manifest.webmanifest`, `sw.js`, `icons/` : installation sur l'écran d'accueil et jeu hors connexion

## Publier sur GitHub Pages
Déposer tous ces fichiers à la racine d'un dépôt, puis Settings → Pages → « Deploy from a branch » → `main` / racine.
