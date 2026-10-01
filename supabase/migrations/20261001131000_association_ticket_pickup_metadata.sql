-- Preserve existing pickup display metadata for ticket-funded registrations.
create or replace function public.register_online_job_with_tickets(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_rolls integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; tickets bigint; v_gold bigint; results jsonb:='[]'; previous private.association_operation_requests%rowtype; result jsonb; i integer; rarity text; job text; v_sr text; v_ssr text;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_rolls is null or p_rolls not in(1,10) then raise exception 'ASSOCIATION_DRAW_INVALID';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select gold into v_gold from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select * into previous from private.association_operation_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous.operation<>'DRAW' or previous.input<>jsonb_build_object('rolls',p_rolls) then raise exception 'ASSOCIATION_REQUEST_CONFLICT';end if;
  return previous.result||jsonb_build_object('state',private.job_registration_state_json(u),'record',private.cloud_record_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'ASSOCIATION_DURING_EXPEDITION';end if;
 select quantity into tickets from private.market_assets where user_id=u and item_id='other:job_draw_ticket' for update;
 if coalesce(tickets,0)<p_rolls then raise exception 'ASSOCIATION_TICKET_SHORTAGE';end if;
 update private.market_assets set quantity=quantity-p_rolls,updated_at=now() where user_id=u and item_id='other:job_draw_ticket';
 select sr_job_id,ssr_job_id into v_sr,v_ssr from private.player_job_pickups where user_id=u;
 for i in 1..p_rolls loop
  rarity:=private.job_registration_draw_rarity();job:=private.job_registration_pick_job(u,rarity);
  results:=results||jsonb_build_array(private.apply_job_registration_record(u,job)||jsonb_build_object('index',i,'pickup',case when rarity='SR' then v_sr is not null and job=v_sr when rarity='SSR' then v_ssr is not null and job=v_ssr else false end));
 end loop;
 perform private.persist_server_association_to_save(u);
 result:=jsonb_build_object('requestId',p_request_id,'paidRolls',p_rolls,'resultCount',p_rolls,'goldCost',0,'goldBefore',v_gold,'goldAfter',v_gold,
  'ticketCost',p_rolls,'results',results,'replayed',false);
 insert into private.association_operation_requests(user_id,request_id,operation,input,result) values(u,p_request_id,'DRAW',jsonb_build_object('rolls',p_rolls),result);
 return result||jsonb_build_object('state',private.job_registration_state_json(u),'record',private.cloud_record_json(u));
end;$$;
revoke all on function public.register_online_job_with_tickets(uuid,bigint,text,text,uuid,integer) from public,anon;
grant execute on function public.register_online_job_with_tickets(uuid,bigint,text,text,uuid,integer) to authenticated;
