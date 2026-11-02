-- Pas Très Pentu Ski Cup : mise à jour V3 de la base des scores (la paire de skis du record).
-- À coller dans Supabase > SQL Editor, puis Run. Une seule fois suffit.
-- Ce script ne supprime rien : les joueurs, les records et le code famille sont conservés.

alter table joueurs add column if not exists ski text
  check (ski is null or ski in ('rhea', 'bec', 'fourcade'));

-- L'ancienne fonction (sans les skis) est remplacée par une seule fonction, où les skis sont facultatifs :
-- les téléphones qui ont encore l'ancienne version du jeu peuvent toujours enregistrer leurs descentes.
drop function if exists enregistrer_descente(text, text, integer, integer, integer);
drop function if exists enregistrer_descente(text, text, integer, integer, integer, text);

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
    ski := null;
  end if;
  insert into joueurs as j (prenom, descentes) values (nom, 1)
    on conflict (prenom) do update set descentes = j.descentes + 1
    returning * into res;
  if temps_ms is not null and (res.meilleur_ms is null or temps_ms < res.meilleur_ms) then
    update joueurs j set meilleur_ms = temps_ms, date_record = now(),
      inter1_ms = i1_ms, inter2_ms = i2_ms, ski = enregistrer_descente.ski
      where j.prenom = nom returning * into res;
  end if;
  return res;
end;
$$;

-- le classement renvoie maintenant aussi la colonne des skis
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

revoke all on function enregistrer_descente(text, text, integer, integer, integer, text) from public;
grant execute on function enregistrer_descente(text, text, integer, integer, integer, text) to anon;
revoke all on function classement(text) from public;
grant execute on function classement(text) to anon;

-- Supabase relit la liste des fonctions
notify pgrst, 'reload schema';
