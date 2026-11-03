// Pas Très Pentu Ski Cup — fichier de tronçons de la piste (V3).
// La même piste pour tout le monde, pour que les chronos soient comparables.
// Distances en mètres de descente depuis la ligne de départ.
// angle : 0 = droit dans la pente ; positif = diagonale vers la droite, négatif = vers la gauche.
window.PISTE_V1 = {
  nom: 'Piste V1',
  longueur: 1500,          // ligne d'arrivée
  largeur: 24,             // largeur du couloir (environ 70 % de l'écran)
  intermediaires: [500, 1000],
  troncons: [
    { longueur: 370, angle: 0 },     // départ + 1er champ de bosses (300 m)
    { longueur: 70,  angle: 25 },
    { longueur: 50,  angle: 0 },
    { longueur: 70,  angle: -25 },
    { longueur: 140, angle: 0 },     // intermédiaire 1 (500 m)
    { longueur: 100, angle: 30 },
    { longueur: 80,  angle: 0 },
    { longueur: 80,  angle: -30 },
    { longueur: 190, angle: 0 },     // 2e champ de bosses + intermédiaire 2 (1000 m)
    { longueur: 80,  angle: 20 },
    { longueur: 90,  angle: 0 },
    { longueur: 80,  angle: -20 },
    { longueur: 200, angle: 0 }      // ligne droite d'arrivée + aire d'arrêt
  ],
  champsDeBosses: [
    // V3.1 — bosses réparties au hasard (le même pour tous) et isolées : nombre de bosses, ecartMin = distance
    // minimale entre deux bosses (m). couloirs : la piste est découpée en bandes verticales qui reçoivent chacune
    // au moins une bosse, pour qu'on ne puisse pas traverser un champ tout droit.
    { debut: 200,  longueur: 50,  nombre: 20, ecartMin: 4.5, couloirs: 14 },  // premier champ, plus facile
    { debut: 1000, longueur: 50,  nombre: 50, ecartMin: 3.0, couloirs: 14 }   // deuxième champ, plus difficile
  ],

  // V2 — deux chasse-neige garés de biais, de chaque côté, en chicane très large (échauffement).
  // cote : -1 = bord gauche, 1 = bord droit ; y = position du centre de l'engin (m).
  chasseNeige: [
    { y: 70,  cote: -1 },
    { y: 100, cote: 1 }
  ],

  // V3.1 — École de ski : un moniteur suivi de 4 enfants, étirés en file sur toute la largeur de la piste,
  // qui descendent en zigzag d'un bord à l'autre à environ 8 km/h : il faut passer entre eux.
  // debut : hauteur où commence le zigzag (m), dans la ligne droite avant le 2e champ de bosses ; depart : l'école se met en
  // route quand le joueur passe cette hauteur ; ecart : distance entre deux skieurs de la file (m) ;
  // descente : mètres de pente descendus à chaque traversée ; marge : distance gardée avec les sapins (m).
  ecoleDeSki: { debut: 815, depart: 745, vitesse: 8, enfants: 4, ecart: 5, descente: 7, marge: 2.5 },

  // V2 — « La soupe et les cailloux ! » : neige lourde (plus jaune) sur les 200 derniers mètres,
  // avec des plaques de terre à contourner. x : position en travers (-1 = bord gauche, 1 = bord droit),
  // r : taille de la plaque (m).
  neigeLourde: { debut: 1300, fin: 1500 },
  plaquesDeTerre: [
    { y: 1322, x: -0.55, r: 2.2 },
    { y: 1346, x: 0.10,  r: 2.6 },
    { y: 1370, x: -0.50, r: 2.3 },
    { y: 1394, x: 0.45,  r: 2.2 },
    { y: 1420, x: -0.20, r: 2.5 },
    { y: 1446, x: 0.50,  r: 2.2 },
    { y: 1468, x: -0.45, r: 2.0 }
  ]
};
