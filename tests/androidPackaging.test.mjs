import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Capacitor project uses the Vite dist bundle and stable package identity',()=>{
 const config=read('capacitor.config.ts');
 assert.match(config,/appId:'com\.studio1524\.towerchronicles'/);
 assert.match(config,/webDir:'dist'/);
 const pkg=JSON.parse(read('package.json'));
 for(const p of ['@capacitor/android','@capacitor/app','@capacitor/browser','@capacitor/core'])assert.ok(pkg.dependencies[p]);
 assert.ok(pkg.devDependencies['@capacitor/cli']);
});

test('native Android OAuth uses an external browser, exact callback and PKCE transaction',()=>{
 const auth=read('src/online/auth.ts');
 const app=read('src/online/nativeAuth.ts');
 const manifest=read('scripts/configure-android.mjs');
 assert.match(auth,/Browser\.open\(\{url:authorize\}\)/);
 assert.match(auth,/createGoogleOAuthUrl\(supabaseConfig,NATIVE_OAUTH_REDIRECT,localStorage\)/);
 assert.match(app,/completeGoogleOAuth\(supabaseConfig,url,localStorage,localStorage\)/);
 assert.match(app,/App\.addListener\('appUrlOpen'/);
 assert.match(app,/App\.getLaunchUrl\(\)/);
 assert.match(manifest,/android:path="\/callback"/);
 assert.match(manifest,/android:screenOrientation/);
});
