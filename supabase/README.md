# La base des scores (Supabase)

Le classement de la famille est stocké dans une base Supabase. Ce dossier contient les scripts SQL qui la créent.

## Quel script lancer ?

| Situation | Script à lancer | Effet |
|---|---|---|
| Nouveau projet Supabase, ou remise à zéro volontaire | `scores.sql` (seul) | **Efface tout**, puis crée la base complète et à jour |
| Base qui tourne déjà, créée avant la V3 (pas de colonne `ski` dans `joueurs`) | `v3-skis.sql` | Ajoute les skis du record, **sans rien effacer** |
| Base qui tourne déjà, avec la colonne `ski` | rien | La base est à jour |

Pour savoir si la base a la colonne `ski` : Supabase > Table Editor > table `joueurs`.

Les scripts se lancent dans Supabase > SQL Editor : coller tout le fichier, puis Run.

⚠️ Ne jamais relancer `scores.sql` sur la base de la famille : il commence par supprimer les tables, donc tous les records.

## Ce qu'il y a dans la base

**`joueurs`** : une ligne par joueur, mise à jour seulement quand il bat son record.

| Colonne | Contenu |
|---|---|
| `prenom` | identifiant du joueur (clé primaire, 1 à 20 caractères) |
| `meilleur_ms` | meilleur temps en millisecondes (entre 10 000 et 120 000), vide s'il n'est jamais arrivé en bas |
| `date_record` | date du record |
| `descentes` | nombre de descentes, chutes comprises |
| `inter1_ms`, `inter2_ms` | temps intermédiaires du record, en millisecondes |
| `ski` | paire de skis du record : `rhea`, `bec` ou `fourcade` |

**`reglages`** : une seule ligne, `code_famille`, le « mot de passe » partagé de la famille (en majuscules).

Pour changer le code famille : Table Editor > `reglages`, ou dans SQL Editor :
`update reglages set code_famille = 'NOUVEAUCODE';`

## Sécurité

- La RLS (Row Level Security) est activée sur les deux tables **sans aucune policy** : le public ne peut ni les lire ni
  les écrire directement.
- Le jeu peut seulement appeler deux fonctions, qui vérifient d'abord le code famille :
  - `classement(code)` renvoie tous les joueurs, du meilleur temps au moins bon ;
  - `enregistrer_descente(code, nom, temps_ms, i1_ms, i2_ms, ski)` compte la descente et remplace le record s'il est battu.
- La clé mise dans `js/config.js` est la clé « publishable » (ou « anon public ») : elle est faite pour être publique.
  Ne jamais y mettre la clé « secret » ni « service_role ».
- Limites, acceptables pour un jeu de famille : avec le code, on peut enregistrer un temps sous n'importe quel prénom,
  et le serveur fait confiance au temps envoyé (il vérifie seulement qu'il est entre 10 s et 2 min).

## Côté jeu

C'est `js/famille.js` qui appelle ces fonctions (`POST <adresse>/rest/v1/rpc/<fonction>`). Le prénom et le code sont
gardés dans le téléphone, et les descentes faites sans réseau sont renvoyées plus tard.
