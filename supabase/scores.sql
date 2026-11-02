-- Pas Très Pentu Ski Cup : base des scores (V2). À coller dans Supabase > SQL Editor, puis Run.
-- Avant de lancer : remplacer NEIGE2026 (plus bas) par le code famille choisi.
-- V3 : sur une base déjà en place, lancer seulement v3-skis.sql (il garde les records). Sur une base neuve, lancer ce fichier puis v3-skis.sql.
drop function if exists classement(text);
drop function if exists enregistrer_descente(text, text, integer, integer, integer);
drop table if exists scores;
drop table if exists joueurs;
drop table if exists reglages;

create table joueurs (
  prenom text primary key check (char_length(prenom) between 1 and 20),
  meilleur_ms integer check (meilleur_ms between 10000 and 120000),
  date_record timestamptz,
  descentes integer not null default 0,
  inter1_ms integer,
  inter2_ms integer
);
alter table joueurs enable row level security;

create table reglages (code_famille text not null);
alter table reglages enable row level security;
insert into reglages values ('NEIGE2026');  -- <== le code famille

create or replace function classement(code text)
returns setof joueurs
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from reglages r where r.code_famille = code) then
    raise exception 'code famille incorrect';
  end if;
  return query select j.* from joueurs j order by j.meilleur_ms asc nulls last, j.prenom;
end;
$$;

create or replace function enregistrer_descente(code text, nom text, temps_ms integer, i1_ms integer, i2_ms integer)
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
  insert into joueurs as j (prenom, descentes) values (nom, 1)
    on conflict (prenom) do update set descentes = j.descentes + 1
    returning * into res;
  if temps_ms is not null and (res.meilleur_ms is null or temps_ms < res.meilleur_ms) then
    update joueurs set meilleur_ms = temps_ms, date_record = now(),
      inter1_ms = i1_ms, inter2_ms = i2_ms
      where prenom = nom returning * into res;
  end if;
  return res;
end;
$$;

revoke all on function classement(text) from public;
revoke all on function enregistrer_descente(text, text, integer, integer, integer) from public;
grant execute on function classement(text) to anon;
grant execute on function enregistrer_descente(text, text, integer, integer, integer) to anon;
