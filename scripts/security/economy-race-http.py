"""Approved disposable public-driver test. Private JSON config via stdin.
Caller must provision and remove fixtures; never use production order/loan data.
"""
import json,sys,time,urllib.request,urllib.error,re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
C=json.load(sys.stdin)
assert re.fullmatch(r'tc_race_[0-9a-f]{8}_driver',C['driver'])
TOKEN=None
def call(path,data,token=None):
    req=urllib.request.Request(C['url']+path,data=json.dumps(data).encode(),headers={
        'apikey':C['key'],'Content-Type':'application/json','Authorization':'Bearer '+(token or C['key'])})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:
            raw=r.read();return r.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:return e.code,json.load(e)
def rpc(action,**kw):
    s,d=call('/rest/v1/rpc/'+C['driver'],{'p_action':action,**kw},TOKEN)
    assert s==200,(action,s,d)
    return d
def ok(d):assert d.get('ok'),d
def pair(label,first,second,kw=None):
    with ThreadPoolExecutor(max_workers=3) as pool:
        f=pool.submit(rpc,first,p_delay_ms=7000,**(kw or {}))
        time.sleep(.15);g=pool.submit(rpc,second);busy=False
        for _ in range(50):
            if f.done():break
            if rpc('probe')['busy']:
                busy=True;break
            time.sleep(.02)
        b=g.result();a=f.result()
    assert a['backend']!=b['backend'],'Same PostgreSQL backend'
    assert max(datetime.fromisoformat(x['started']) for x in(a,b))<min(datetime.fromisoformat(x['finished']) for x in(a,b)),('No backend overlap',a,b)
    print(json.dumps({'case':label,'distinct_backends':True,'lock_busy_observed':busy,'backend_intervals_overlap':True}),flush=True)
    return a,b
s,d=call('/auth/v1/token?grant_type=password',{'email':C['email'],'password':C['password']})
assert s==200,('login',s)
TOKEN=d['access_token']
s,d=call('/rest/v1/rpc/'+C['driver'],{'p_action':'snapshot'})
assert s in(401,403),('anon permitted',s)
print('PASS: anonymous execution denied',flush=True)
cases=[] if '--bank-only' in sys.argv else [
    ('cancel before buy','cancel','buy',10,0),
    ('full buy before cancel','buy','cancel',10,10),
    ('partial buy before cancel','buy','cancel',5,5)]
for label,first,second,qty,filled in cases:
    rpc('reset_market');ok(rpc('sell'))
    a,b=pair(label,first,second,{'p_quantity':qty} if first=='buy' else {})
    ok(a)
    if filled==10:assert b.get('error')=='ORDER_NOT_CANCELLABLE',b
    else:ok(b)
    m=rpc('snapshot')['market']
    assert m['stock']==10 and m['wallet']+m['escrow']+m['fees']==20000 and m['traded']==filled,m
    print('PASS: stock and currency conserved',flush=True)
for first,second in [('auto','repay'),('repay','auto')]:
    rpc('reset_bank');a,b=pair(first+' before '+second,first,second);ok(a)
    if second=='repay':assert b.get('error')=='BANK_LOAN_CLOSED',b
    else:
        ok(b);assert b['result']['processed']==0,b
        ok(rpc('repay'))
    bank=rpc('snapshot')['bank']
    assert bank['status']=='REPAID' and bank['wallet']==45000 and bank['vault']==55000 and bank['tickets']==1 and bank['ledger']==1,bank
    print('PASS: repayment and collateral applied once',flush=True)
rpc('reset_bank',p_expired=True)
a,b=pair('default before manual repayment','auto','repay')
ok(a);assert b.get('error')=='BANK_LOAN_CLOSED',b
bank=rpc('snapshot')['bank']
assert bank['status']=='DEFAULTED' and bank['wallet']==100000 and bank['vault']==0 and bank['tickets']==0 and bank['collateral']==1 and bank['ledger']==1,bank
print('PASS: default applied once without wallet charge',flush=True)
print('PASS: '+str(len(cases)+3)+' backend overlap scenarios complete',flush=True)
