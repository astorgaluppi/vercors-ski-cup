// Pas Très Pentu Ski Cup — fichier de tronçons de la piste V1.
// La même piste pour tout le monde, pour que les chronos soient comparables.
// Distances en mètres de descente depuis la ligne de départ.
// angle : 0 = droit dans la pente ; positif = diagonale vers la droite, négatif = vers la gauche.
window.PISTE_V1 = {
  nom: 'Piste V1',
  longueur: 1500,          // ligne d'arrivée
  largeur: 24,             // largeur du couloir (environ 70 % de l'écran)
  intermediaires: [500, 1000],
  troncons: [
    { longueur: 300, angle: 0 },     // départ + 1er champ de bosses (200 m)
    { longueur: 70,  angle: 25 },
    { longueur: 50,  angle: 0 },
    { longueur: 70,  angle: -25 },
    { longueur: 210, angle: 0 },     // intermédiaire 1 (500 m)
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
    { debut: 200,  longueur: 50,  ecartRangs: 8,   ecartBosses: 7.5 },  // premier champ, plus facile
    { debut: 1000, longueur: 50,  ecartRangs: 5.5, ecartBosses: 5.2 }
  ]
};
