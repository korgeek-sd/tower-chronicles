-- New guilds only: preserve historic names and current membership data.
-- This helper matches src/game/association/nameRules.ts.
create or replace function private.association_name_allowed(p_name text)
returns boolean
language sql immutable strict
set search_path = ''
as $policy$
 select
    char_length(p_name) between 2 and 6
    and p_name ~ '^[가-힣A-Za-z0-9]{2,6}$'
    and p_name !~ '^[0-9]+$'
    and p_name !~ '(.)\1{3,}'
    and not (lower(p_name) = any(array['탑기록원','노바르평의회','은저울상회','네공방연맹','청동마차상단','미친놈','미친년','개자식','쓰레기','나치','히틀러','카지노','도박','불법도박','sex','nude','xxx','dick','pussy','slut','whore','kkk','mod','staff','dev','system','casino','cheat','hack']::text[]))
    and not exists(
      select 1 from unnest(array['씨발','시발','씨팔','시팔','씨바','시바','병신','븅신','빙신','개새끼','개쉐끼','좆','좃','존나','졸라','지랄','염병','섹스','야동','포르노','자위','성매매','보지','자지','후장','딸딸이','강간','성폭행','근친','한남','김치녀','틀딱','맘충','짱깨','쪽바리','운영자','관리자','개발자','게임마스터','고객센터','공식운영','운영팀','현금거래','계정판매','대리육성','fuck','fuk','fck','f0ck','shit','bitch','cunt','asshole','porn','porno','hentai','rape','rapist','nazi','gm','admin','rmt','sellacc','sibal','shibal','ssibal','s1bal','b1tch']::text[]) as blocked(word)
      where position(blocked.word in lower(p_name))>0
    );
$policy$;
revoke all on function private.association_name_allowed(text) from public,anon,authenticated;

create or replace function public.create_online_association_v2(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_name text,p_description text,p_join_policy text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  u uuid;
  v_name text:=coalesce(p_name,'');
  v_assoc private.online_associations%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_record text;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(u);
  if exists(select 1 from private.online_association_members where user_id=u) then raise exception 'ASSOCIATION_ALREADY_JOINED';end if;
  if not private.association_name_allowed(v_name) then
    raise exception 'ASSOCIATION_NAME_INVALID';
  end if;
  if char_length(coalesce(p_description,''))>120 or p_join_policy not in('OPEN','APPROVAL') then
    raise exception 'ASSOCIATION_INPUT_INVALID';
  end if;
  if exists(select 1 from private.online_associations
    where status='ACTIVE'
    and lower(regexp_replace(normalize(name, NFKC),'[[:space:]]+','','g')) =
        lower(regexp_replace(normalize(v_name, NFKC),'[[:space:]]+','','g'))) then
    raise exception 'ASSOCIATION_NAME_TAKEN';
  end if;

  select * into v_wallet from private.player_wallets where user_id=u for update;
  if not found or v_wallet.silver<1000 then raise exception 'ASSOCIATION_SILVER_SHORTAGE';end if;
  update private.player_wallets set silver=silver-1000,updated_at=now() where user_id=u;

  v_record:='NR-'||to_char(nextval('private.online_association_record_seq'::regclass),'FM000000');
  insert into private.online_associations(
    record_number,name,description,leader_user_id,join_policy
  ) values(
    v_record,v_name,btrim(coalesce(p_description,'')),u,p_join_policy
  ) returning * into v_assoc;

  insert into private.online_association_members(association_id,user_id,role)
  values(v_assoc.association_id,u,'LEADER');

  perform private.association_activity(v_assoc.association_id,u,'CREATED','원정단이 탑기록원에 등록되었습니다.');
  perform private.persist_server_association_to_save(u);
  perform private.broadcast_association_change(v_assoc.association_id);
  return private.online_association_result(u);
end;$$;
