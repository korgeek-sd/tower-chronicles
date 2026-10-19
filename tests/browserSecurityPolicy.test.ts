import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {browserPolicy,authorizeStandaloneScripts} from '../scripts/security/browser-policy.mjs';

test('production policy allows only the configured API and realtime origins',()=>{
 const policy=browserPolicy('https://example.supabase.co');
 assert.ok(policy.includes("connect-src 'self' https://example.supabase.co wss://example.supabase.co;"));
 assert.ok(policy.includes("script-src 'self'; script-src-attr 'none'"));
 assert.ok(policy.includes("default-src 'none'"));
 assert.ok(!/unsafe-eval|script-src[^;]*unsafe-inline|localhost|https:\s/.test(policy));
 assert.throws(()=>browserPolicy('https://example.com/evil'));
 assert.throws(()=>browserPolicy('http://example.com'));
 assert.throws(()=>browserPolicy('https://user:pass@example.com'));
 assert.equal(browserPolicy(undefined).split('connect-src ')[1].split(';')[0],"'self'");
});
test('standalone build authorizes exact script bytes without allowing arbitrary inline scripts',()=>{
 const script='document.body.textContent="hello";';
 const html='<meta content="'+browserPolicy(undefined)+'"><script type="module">'+script+'</script>';
 const result=authorizeStandaloneScripts(html);
 assert.ok(result.includes("'sha256-"+createHash('sha256').update(script).digest('base64')+"'"));
 assert.ok(!result.includes("script-src 'self' 'unsafe-inline'"));
 assert.ok(result.endsWith('<script type="module">'+script+'</script>'));
});
test('standalone policy handles HTML-escaped CSP emitted by Vite',()=>{
 const html='<meta content="script-src &#39;self&#39;; object-src &#39;none&#39;"><script type="module">export {};</script>';
 assert.ok(authorizeStandaloneScripts(html).includes("script-src 'self' 'sha256-"));
});
