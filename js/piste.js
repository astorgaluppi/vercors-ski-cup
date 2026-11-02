// Pas Très Pentu Ski Cup — fichier de tronçons de la piste (V2).
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
    // ecartRangs / ecartBosses : distance entre deux rangées et entre deux bosses d'une rangée (m)
    // V3 — premier champ en « passages » : rangées de bosses serrées avec un seul passage par rangée,
    // largeurPassage (m) de large, centré à tour de rôle sur chaque valeur de passages (m depuis le milieu,
    // négatif = à gauche). Le passage change de côté à chaque rangée : impossible de passer tout droit.
    { debut: 300,  longueur: 50,  ecartRangs: 12.5, ecartBosses: 1.5, largeurPassage: 6, passages: [-3.5, 3.5] },  // premier champ, plus facile
    { debut: 1000, longueur: 50,  ecartRangs: 8,   ecartBosses: 7.5 }
  ],

  // V2 — deux chasse-neige garés de biais, de chaque côté, en chicane très large (échauffement).
  // cote : -1 = bord gauche, 1 = bord droit ; y = position du centre de l'engin (m).
  chasseNeige: [
    { y: 70,  cote: -1 },
    { y: 100, cote: 1 }
  ],

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
