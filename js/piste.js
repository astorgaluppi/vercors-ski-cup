// Pas Très Pentu Ski Cup — fichier de tronçons de la piste (V4).
// La même piste pour tout le monde, pour que les chronos soient comparables.
// Distances en mètres de descente depuis la ligne de départ.
// angle : 0 = droit dans la pente ; positif = diagonale vers la droite, négatif = vers la gauche.
window.PISTE_V1 = {
  nom: 'Piste V1',
  longueur: 1500,          // ligne d'arrivée
  largeur: 24,             // largeur du couloir (environ 70 % de l'écran)
  intermediaires: [500, 1000],
  troncons: [
    { longueur: 370, angle: 0 },     // départ + 1er champ de bosses (200 m) + canons à neige (365 m)
    { longueur: 70,  angle: 25 },     // diagonale dans le nuage des canons à neige
    { longueur: 50,  angle: 0 },
    { longueur: 70,  angle: -25 },
    { longueur: 140, angle: 0 },     // intermédiaire 1 (500 m) + biathlète (vers 680 m)
    { longueur: 100, angle: 30 },
    { longueur: 80,  angle: 0 },
    { longueur: 80,  angle: -30 },
    { longueur: 190, angle: 0 },     // intermédiaire 2 (1000 m) + Frères Lhuillier (1000 m) + 2e champ de bosses (1100 m)
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
    { debut: 1100, longueur: 50,  nombre: 50, ecartMin: 3.0, couloirs: 14 }   // deuxième champ, plus difficile
  ],

  // V2 — deux chasse-neige garés de biais, de chaque côté, en chicane très large (échauffement).
  // cote : -1 = bord gauche, 1 = bord droit ; y = position du centre de l'engin (m).
  chasseNeige: [
    { y: 70,  cote: -1 },
    { y: 100, cote: 1 }
  ],

  // V3.1 — École de ski : un moniteur suivi de 6 enfants, étirés en file sur toute la largeur de la piste,
  // qui descendent en zigzag d'un bord à l'autre à environ 8 km/h : il faut passer entre eux.
  // debut : hauteur où commence le zigzag (m), dans la ligne droite avant le 2e champ de bosses ; depart : l'école se met en
  // route quand le joueur passe cette hauteur ; ecart : distance entre deux skieurs de la file (m) ;
  // descente : mètres de pente descendus à chaque traversée ; marge : distance gardée avec les sapins (m).
  ecoleDeSki: { debut: 815, depart: 745, vitesse: 8, enfants: 6, ecart: 5, descente: 7, marge: 2.5 },

  // V4 — Canons à neige (« Canons à neige ! »), vers 365 m (V4.1 : 100 m plus loin), pour que le nuage couvre aussi
  // le début du secteur en diagonale (370 à 440 m).
  // Les canons se mettent en marche quand le joueur passe « depart » et soufflent pendant « duree » secondes :
  // un nuage de neige couvre l'écran et ne laisse voir qu'environ 30 % de la piste (« visible »).
  // canons : y = hauteur du canon (m), cote : -1 = bord gauche, 1 = bord droit.
  canonsANeige: {
    depart: 365, duree: 6.5, visible: 0.3,
    canons: [{ y: 375, cote: -1 }, { y: 395, cote: 1 }, { y: 415, cote: -1 }, { y: 435, cote: 1 }]
  },

  // V4.1 — Bosses isolées, cachées dans le nuage des canons à neige (pas de banderole).
  // x : position en travers (-1 = bord gauche, 1 = bord droit). Mêmes règles de chute que les champs de bosses.
  bossesIsolees: [
    { y: 392, x: -0.30 },
    { y: 418, x: 0.35 },
    { y: 446, x: -0.05 }
  ],

  // V4 — Le biathlète (« Martin Fourcade ! »), vers 680 m (V4.1 : déplacé dans le long secteur sans obstacle avant
  // l'école de ski) : il remonte la piste à contresens en pas de patineur. debut : hauteur d'où il part (m) ;
  // depart : il se met en route quand le joueur passe cette hauteur ; vitesse : vitesse de montée (km/h) ;
  // lateral : vitesse (km/h) à laquelle il se décale vers le joueur, tant qu'il est devant lui.
  biathlete: { debut: 700, depart: 590, vitesse: 11, lateral: 11 },

  // V4 — Les Frères Lhuillier (« Les frères Lhuillier ! »), vers 1 000 m, juste après la sortie du futur passage
  // secret (V5) et avant le 2e champ de bosses. Deux frères en treillis sortent des sapins, un de chaque côté, et
  // lancent des sacs de pièces d'or sur la piste. Une cible apparaît au sol « preavis » secondes avant que le sac
  // tombe ; être dans son rayon (m) à ce moment-là fait tomber. Les lancers visent l'endroit où va le joueur,
  // tant qu'il est entre « debut » et « fin », un sac toutes les « intervalle » secondes, en alternant les frères.
  lhuillier: {
    depart: 955, debut: 975, fin: 1068, preavis: 1, rayon: 1.6, intervalle: 0.8,
    freres: [{ y: 1008, cote: -1 }, { y: 1036, cote: 1 }]
  },

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
