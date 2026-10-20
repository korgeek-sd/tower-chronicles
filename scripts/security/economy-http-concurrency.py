import json,urllib.request,urllib.error,time,threading,uuid,sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
C=json.loads(Path(sys.argv[1]).read_text())
TOKEN=None
def call(path,data,token=None):
 req=urllib.request.Request(C['url']+path,data=json.dumps(data).encode(),headers={'apikey':C['key'],'Authorization':'Bearer '+(token or C['key']),'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def rpc(name,data):return call('/rest/v1/rpc/'+name,data,TOKEN)
status,d=call('/auth/v1/token?grant_type=password',{'email':C['email'],'password':C['password']})
assert status==200,('login',status)
TOKEN=d['access_token']
status,d=rpc('acquire_game_session',{'p_device_id':'economy-http-qa','p_client_instance_id':'economy-http-qa','p_platform':'QA','p_app_version':'security-test'})
assert status==200 and d[0]['status']=='ACTIVE',('lease',status)
A={'p_lease_id':d[0]['lease_id'],'p_generation':d[0]['generation'],'p_client_instance_id':'economy-http-qa','p_device_id':'economy-http-qa'}
def race(label,name,data):
 barrier=threading.Barrier(4)
 def worker(i):
  barrier.wait()
  start=time.monotonic()
  s,d=rpc(name,{**A,**data})
  end=time.monotonic()
  assert s==200,(label,s,d.get('message') if isinstance(d,dict) else 'invalid response')
  return start,end,d
 with ThreadPoolExecutor(max_workers=4) as pool:rs=list(pool.map(worker,range(4)))
 assert max(x[0] for x in rs)<min(x[1] for x in rs),'HTTP intervals did not overlap'
 print(json.dumps({'case':label,'overlapping_requests':4,'statuses':[200]*4}),flush=True)
 return rs[-1][2]
def expect_error(name,data,message):
 s,d=rpc(name,{**A,**data})
 assert s>=400 and message in d.get('message',''),('expected rejection',message,s)
 print('PASS: '+message,flush=True)
d=race('same mail claim','manage_game_mail',{'p_action':'claim','p_mail_id':C['mailId']})
w=d['economy']['wallet']
assert int(w['silver'])==C['initialSilver']+2 and int(w['gold'])==C['initialGold']+1,w
assert next(int(a['quantity']) for a in d['economy']['assets'] if a['itemId']=='other:job_draw_ticket')==C['initialItemQuantity']+1
print('PASS: mail reward applied exactly once',flush=True)
d=race('same deposit request','server_bank_action',{'p_request_id':C['depositRequestId'],'p_action':'DEPOSIT','p_params':{'amount':100}})
assert int(d['state']['silver'])==C['initialSilver']+2-100 and int(d['state']['myBank']['vault'])==C['initialVault']+100
d=race('same withdrawal request','server_bank_action',{'p_request_id':C['withdrawRequestId'],'p_action':'WITHDRAW','p_params':{'amount':200}})
assert int(d['state']['silver'])==C['initialSilver']+2+100 and int(d['state']['myBank']['vault'])==C['initialVault']-100
print('PASS: bank replay applied once; wallet+vault conserved',flush=True)
expect_error('server_bank_action',{'p_request_id':C['depositRequestId'],'p_action':'DEPOSIT','p_params':{'amount':101}},'BANK_REQUEST_CONFLICT')
expect_error('server_bank_action',{'p_request_id':str(uuid.uuid4()),'p_action':'WITHDRAW','p_params':{'amount':C['initialVault']+1}},'BANK_VAULT_SHORTAGE')
expect_error('server_bank_action',{'p_request_id':str(uuid.uuid4()),'p_action':'DEPOSIT','p_params':{'amount':-1}},'BANK_INPUT_INVALID')
expect_error('server_bank_action',{'p_request_id':None,'p_action':'WITHDRAW','p_params':{'amount':1}},'BANK_INPUT_INVALID')
print('PASS: HTTP economy concurrency checks complete',flush=True)
