# Tests automatiques du jeu

Ce dossier contient des **tests automatiques** : de petits programmes qui jouent au jeu à notre place
et vérifient qu'il marche toujours après une modification. Ils ne changent rien au jeu lui-même :
le jeu n'en a pas besoin pour fonctionner, et les joueurs ne les voient jamais.

## Ce qui est vérifié

| Fichier | Ce que le test vérifie |
|---|---|
| `1-chargement.spec.js` | La page d'accueil s'affiche **sans erreur JavaScript**, et la piste de `js/piste.js` est cohérente (les tronçons vont jusqu'à l'arrivée, les temps intermédiaires sont dans l'ordre). |
| `2-champs-de-bosses.spec.js` | Pour chaque champ de bosses de `js/piste.js` : le bon **nombre** de bosses, le même nombre dans chaque **couloir**, jamais deux bosses plus proches que **`ecartMin`**, et **aucune ligne droite libre** pour traverser le champ sans toucher de bosse. |
| `3-descente-automatique.spec.js` | Un **pilote automatique** fait une descente complète avec chacune des trois paires de skis : il doit arriver en bas sans tomber, en moins de 2 minutes, avec les deux temps intermédiaires et l'écran des résultats. |

## Comment ça marche

1. **Playwright** ouvre le jeu dans un vrai navigateur (Chromium), mais **sans fenêtre** à l'écran.
2. Un petit serveur web (`outils/serveur.js`) sert les fichiers du dépôt, comme GitHub Pages.
3. Le jeu donne aux tests une **porte d'entrée** : l'objet `window.PTPSC`, tout en bas de `js/game.js`.
   Il permet de lire l'état du skieur (`state`), les bosses (`bumps`), la piste (`track`), et d'avancer
   le jeu d'une image (`step`), de choisir les skis (`setSki`) ou de lancer une course (`resetRace`).
4. Le **pilote automatique** (`outils/pilote-automatique.js`) « tient les manettes » à la place d'un joueur :
   à chaque image, il regarde la piste devant lui, choisit le chemin le moins dangereux et règle sa vitesse.
   Il ne triche pas : il ne déplace jamais le skieur, il appuie seulement sur gauche, droite, schuss ou chasse-neige.
5. Le **classement en ligne est bloqué** pendant les tests (`outils/ouvrir-le-jeu.js`) : les tests ne touchent
   jamais au vrai classement de la famille, et ils marchent même sans Internet.

## Lire le résultat sur GitHub

Les tests se lancent tout seuls sur GitHub **à chaque pull request** et à chaque modification de `main`
(réglage dans `.github/workflows/tests.yml`).

- Dans une pull request, regarder en bas de la page (ou l'onglet **Checks**) la ligne
  « Tests du jeu / Tests automatiques » :
  - 🟡 rond jaune : les tests tournent (environ 1 à 2 minutes) ;
  - ✅ coche verte : tous les tests sont passés, la modification ne casse rien de ce qui est vérifié ;
  - ❌ croix rouge : au moins un test a échoué.
- En cas de croix rouge, cliquer sur **Details**, puis sur l'étape **« Lancer les tests »** : chaque test est listé
  avec ✓ (réussi) ou ✘ (raté), et pour un test raté, un message en français dit ce qui ne va pas
  (par exemple « champ de bosses à 200 m, couloir n°3 » ou « chute « bosse » à 1 192 m »).
- Un rapport plus détaillé peut être téléchargé en bas de la page du résumé (« rapport-des-tests »).

Une croix rouge n'empêche pas de fusionner : c'est un avertissement, à regarder avant de décider.

## Lancer les tests sur son ordinateur (facultatif)

Il faut [Node.js](https://nodejs.org) (version 18 ou plus). Dans un terminal, dans le dossier du dépôt :

```
npm install                          # une seule fois : installe Playwright
npx playwright install chromium      # une seule fois : installe le navigateur de test
npm test                             # lance tous les tests (environ 20 secondes)
```

Pour ne lancer qu'un fichier : `npx playwright test tests/2-champs-de-bosses.spec.js`.

## Si un test échoue

- **Le test a peut-être raison** : la modification a cassé quelque chose (lire le message d'erreur).
- **Ou la règle a changé exprès** : par exemple si on décide qu'un champ peut avoir une ligne droite libre,
  il faut aussi changer le test correspondant.
- Pour la descente automatique : si on ajoute un nouvel obstacle, il se peut que le **pilote** ne sache
  pas encore l'éviter. Le message indique où et pourquoi il est tombé ; il faut alors apprendre au pilote
  à éviter ce nouvel obstacle (fonction `danger` dans `outils/pilote-automatique.js`).
