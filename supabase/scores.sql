-- =====================================================================================================
-- Pas Très Pentu Ski Cup : INSTALLATION COMPLÈTE de la base des scores (à jour : V3, skis du record).
-- =====================================================================================================
--
-- QUAND LE LANCER ?
--   Seulement pour créer la base à partir de zéro (nouveau projet Supabase, ou remise à zéro volontaire).
--   Ce fichier suffit à lui seul : inutile de lancer v3-skis.sql ensuite.
--
-- ⚠️  ATTENTION : CE SCRIPT EFFACE TOUT (joueurs, records, code famille) avant de tout recréer.
--     Pour une base qui tourne déjà, NE PAS le lancer : voir README.md dans ce dossier.
--
-- COMMENT ?
--   1. Remplacer NEIGE2026 (section 2, plus bas) par le code famille choisi, EN MAJUSCULES
--      (le jeu met le code tapé en majuscules avant de l'envoyer).
--   2. Supabase > SQL Editor > coller tout le fichier > Run.
--   3. Mettre l'adresse du projet et la clé « publishable » dans js/config.js (jamais la clé secret / service_role).
--
-- PRINCIPE DE SÉCURITÉ
--   Les tables ont la RLS activée SANS AUCUNE policy : le public (rôle anon, celui de la clé du jeu) ne peut
--   ni les lire ni les écrire directement. Il peut seulement appeler les deux fonctions de la section 3,
--   qui vérifient le code famille puis travaillent sur les tables avec les droits de leur créateur
--   (security definer).
-- =====================================================================================================


-- ---------- 1. Remise à zéro (supprime l'ancienne base, toutes versions confondues) ----------
drop function if exists classement(text);
drop function if exists enregistrer_descente(text, text, integer, integer, integer);        -- signature V2
drop function if exists enregistrer_descente(text, text, integer, integer, integer, text);  -- signature V3
drop table if exists scores;   -- table de la V1, plus utilisée
drop table if exists joueurs;
drop table if exists reglages;


-- ---------- 2. Tables ----------

-- Une ligne par joueur (pas une ligne par descente) : la ligne n'est mise à jour que quand le joueur bat son record.
-- Les temps sont en millisecondes entières (le jeu fait Math.round(secondes * 1000)).
create table joueurs (
  prenom text primary key check (char_length(prenom) between 1 and 20),  -- identifiant du joueur
  meilleur_ms integer check (meilleur_ms between 10000 and 120000),      -- meilleur temps (10 s à 2 min), vide tant qu'il n'est jamais arrivé
  date_record timestamptz,                                               -- date du record
  descentes integer not null default 0,                                  -- nombre de descentes, chutes comprises
  inter1_ms integer,                                                     -- 1er temps intermédiaire du record
  inter2_ms integer,                                                     -- 2e temps intermédiaire du record
  ski text check (ski is null or ski in ('rhea', 'bec', 'fourcade'))     -- paire de skis du record (V3)
);
alter table joueurs enable row level security;

-- Le code famille : une seule ligne, c'est le « mot de passe » partagé par toute la famille.
create table reglages (code_famille text not null);
alter table reglages enable row level security;
insert into reglages values ('NEIGE2026');  -- <== le code famille, EN MAJUSCULES


-- ---------- 3. Les deux seules fonctions accessibles au jeu ----------

-- Lire le classement : tous les joueurs, du meilleur temps au moins bon (ceux sans temps à la fin).
create or replace function classement(code text)
returns setof joueurs
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from reglages r where r.code_famille = code) then
    raise exception 'code famille incorrect';  -- le jeu reconnaît ce message et redemande le code
  end if;
  return query select j.* from joueurs j order by j.meilleur_ms asc nulls last, j.prenom;
end;
$$;

-- Enregistrer une descente, appelée à chaque fin de descente (arrivée, chute ou temps dépassé).
-- temps_ms est vide (null) pour une chute ou un temps dépassé : la descente est seulement comptée.
-- ski est facultatif : une ancienne version du jeu peut appeler la fonction sans lui.
create or replace function enregistrer_descente(code text, nom text, temps_ms integer, i1_ms integer, i2_ms integer, ski text default null)
returns joueurs
language plpgsql security definer set search_path = public
as $$
declare res joueurs;
begin
  if not exists (select 1 from reglages r where r.code_famille = code) then
    raise exception 'code famille incorrect';
  end if;
  nom := trim(nom);
  if char_length(nom) < 1 or char_length(nom) > 20 then
    raise exception 'prénom invalide';
  end if;
  if temps_ms is not null and (temps_ms < 10000 or temps_ms > 120000) then
    raise exception 'temps invalide';
  end if;
  if ski is not null and ski not in ('rhea', 'bec', 'fourcade') then
    ski := null;  -- paire inconnue : on garde le temps, sans les skis
  end if;
  -- crée le joueur à sa première descente, sinon ajoute 1 à son nombre de descentes
  insert into joueurs as j (prenom, descentes) values (nom, 1)
    on conflict (prenom) do update set descentes = j.descentes + 1
    returning * into res;
  -- record battu (ou premier temps) : on le remplace
  if temps_ms is not null and (res.meilleur_ms is null or temps_ms < res.meilleur_ms) then
    update joueurs j set meilleur_ms = temps_ms, date_record = now(),
      inter1_ms = i1_ms, inter2_ms = i2_ms, ski = enregistrer_descente.ski
      where j.prenom = nom returning * into res;
  end if;
  return res;
end;
$$;


-- ---------- 4. Droits : le public peut appeler ces deux fonctions, et rien d'autre ----------
revoke all on function classement(text) from public;
revoke all on function enregistrer_descente(text, text, integer, integer, integer, text) from public;
grant execute on function classement(text) to anon;
grant execute on function enregistrer_descente(text, text, integer, integer, integer, text) to anon;

-- Supabase relit la liste des fonctions
notify pgrst, 'reload schema';
