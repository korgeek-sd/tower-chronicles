import asyncio,json,uuid,urllib.request,sys
from pathlib import Path
import websockets
C=json.loads(Path(sys.argv[1]).read_text())
G=C['associationId']
def send_chat(u):
 cid=str(uuid.uuid4())
 req=urllib.request.Request(C['url']+'/rest/v1/game_chat_messages',data=json.dumps({'body':'비공개 보안 검증','client_id':cid,'association_id':G}).encode(),headers={'apikey':C['key'],'Authorization':'Bearer '+u['token'],'Content-Type':'application/json','Prefer':'return=minimal'})
 with urllib.request.urlopen(req,timeout=15) as r:assert r.status in (200,201)
 return cid
def leave_association():
 u=C['users'][1]
 def rpc(name,data):
  req=urllib.request.Request(C['url']+'/rest/v1/rpc/'+name,data=json.dumps(data).encode(),headers={'apikey':C['key'],'Authorization':'Bearer '+u['token'],'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=15) as r:return json.load(r)
 lease=rpc('acquire_game_session',{'p_device_id':'realtime-security-qa','p_client_instance_id':'realtime-security-qa','p_platform':'QA','p_app_version':'security-test'})[0]
 args={'p_lease_id':lease['lease_id'],'p_generation':lease['generation'],'p_client_instance_id':'realtime-security-qa','p_device_id':'realtime-security-qa'}
 rpc('save_game_state',{**args,'p_base_revision':0,'p_save_schema':23,'p_app_version':'security-test','p_payload':{},'p_payload_hash':'unused'})
 rpc('leave_online_association',args)
async def receive_chat(ws,cid,timeout):
 end=asyncio.get_running_loop().time()+timeout
 while True:
  remaining=end-asyncio.get_running_loop().time()
  if remaining<=0:return False
  try:m=json.loads(await asyncio.wait_for(ws.recv(),remaining))
  except asyncio.TimeoutError:return False
  if m[3]=='postgres_changes' and m[4].get('data',{}).get('record',{}).get('client_id')==cid:return True
async def main():
 for u in C['users']:
  req=urllib.request.Request(C['url']+'/auth/v1/token?grant_type=password',data=json.dumps({'email':u['email'],'password':u['password']}).encode(),headers={'apikey':C['key'],'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=15) as r:u['token']=json.load(r)['access_token']
 url=C['url'].replace('https:','wss:')+'/realtime/v1/websocket?apikey='+C['key']+'&vsn=2.0.0'
 async with websockets.connect(url,open_timeout=15) as ws:
  await ws.send(json.dumps(['1','1','realtime:security-qa-chat','phx_join',{'access_token':C['users'][1]['token'],'config':{'private':False,'broadcast':{'ack':False,'self':False},'presence':{'enabled':False},'postgres_changes':[{'event':'INSERT','schema':'public','table':'game_chat_messages'}]}}]))
  while True:
   m=json.loads(await asyncio.wait_for(ws.recv(),20))
   if m[3]=='phx_reply' and m[4].get('status')!='ok':raise RuntimeError('Chat join rejected: '+str(m[4].get('response',{}).get('reason')))
   if m[3]=='system' and m[4].get('extension')=='postgres_changes':
    assert m[4].get('status')=='ok',str(m[4]);break
  cid=await asyncio.to_thread(send_chat,C['users'][0])
  assert await receive_chat(ws,cid,10),'Member did not receive chat'
  print('PASS: member received live chat',flush=True)
  await asyncio.to_thread(leave_association)
  print('PASS: test member left through normal authenticated RPC',flush=True)
  cid=await asyncio.to_thread(send_chat,C['users'][0])
  assert not await receive_chat(ws,cid,8),'Former member received live chat'
  print('PASS: same open WebSocket stopped receiving association messages after membership removal',flush=True)
asyncio.run(main())
