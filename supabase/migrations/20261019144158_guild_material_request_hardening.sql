-- Keep the installed expedition/ownership/receipt rules and existing grants.
-- A local variable named listing_id made the material escrow INSERT ambiguous.
do $hardening$
declare fn regprocedure;definition text;
begin
 fn:=to_regprocedure('public.register_guild_material_auction(uuid,bigint,text,text,uuid,text,bigint,bigint)');
 if fn is null then raise exception 'GUILD_MATERIAL_REGISTER_MISSING';end if;
 definition:=pg_get_functiondef(fn);
 if position('balance bigint;listing_id uuid;' in definition)=0
 or position('returning listing_id into listing_id;' in definition)=0
 or position('p_request_id is null or p_material not in' in definition)=0
 or position($fragment$balance,listing_id,'24시간 공헌도 경매 등록'$fragment$ in definition)=0
 then raise exception 'GUILD_MATERIAL_REGISTER_BASELINE_CHANGED';end if;
 definition:=replace(definition,'balance bigint;listing_id uuid;','balance bigint;v_listing_id uuid;');
 definition:=replace(definition,'returning listing_id into listing_id;','returning listing_id into v_listing_id;');
 definition:=replace(definition,$fragment$balance,listing_id,'24시간 공헌도 경매 등록'$fragment$,$fragment$balance,v_listing_id,'24시간 공헌도 경매 등록'$fragment$);
 definition:=replace(definition,'p_request_id is null or p_material not in','p_request_id is null or p_material is null or p_material not in');
 execute definition;

 fn:=to_regprocedure('public.transfer_guild_material(uuid,bigint,text,text,uuid,text,text,bigint)');
 if fn is null then raise exception 'GUILD_MATERIAL_TRANSFER_MISSING';end if;
 definition:=pg_get_functiondef(fn);
 if position('p_request_id is null or p_direction not in' in definition)=0
 or position('or p_material not in' in definition)=0
 then raise exception 'GUILD_MATERIAL_TRANSFER_BASELINE_CHANGED';end if;
 definition:=replace(definition,'p_request_id is null or p_direction not in','p_request_id is null or p_direction is null or p_direction not in');
 definition:=replace(definition,'or p_material not in','or p_material is null or p_material not in');
 execute definition;
end;
$hardening$;
