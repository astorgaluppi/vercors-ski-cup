# Pas Très Pentu Ski Cup — V1

Petit jeu de ski en famille, jouable dans le navigateur d'un téléphone (portrait) ou d'un ordinateur.

## Jouer
- Téléphone : poser le pouce n'importe où et glisser (gauche / droite pour tourner, bas pour le schuss, haut pour le chasse-neige).
- Ordinateur : flèches du clavier (Entrée ou Espace pour « Jouer » / « Rejouer »).

## Contenu de la V1
Piste de 1 500 m avec sapins du bord et deux champs de bosses (200 m et 1 000 m), compte à rebours,
chrono au dixième, vitesse en km/h, temps intermédiaires à 500 m et 1 000 m, arrivée avec aire d'arrêt,
« Chute ! » et « Hors délai » (2 min). Rien n'est enregistré.

## Fichiers
- `index.html` : la page et les écrans
- `js/piste.js` : le fichier de tronçons (tracé de la piste, champs de bosses)
- `js/game.js` : le jeu (physique, dessins, commandes) ; réglages en haut du fichier (`CFG`)
- `manifest.webmanifest`, `sw.js`, `icons/` : installation sur l'écran d'accueil et jeu hors connexion

## Publier sur GitHub Pages
Déposer tous ces fichiers à la racine d'un dépôt, puis Settings → Pages → « Deploy from a branch » → `main` / racine.
