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
 assert.match(auth,/createGoogleOAuthUrl\(supabaseConfig,NATIVE_OAUTH_REDIRECT,localStorage,'native'\)/);
 assert.match(app,/completeGoogleOAuth\(supabaseConfig,url,localStorage,localStorage\)/);
 assert.match(app,/App\.addListener\('appUrlOpen'/);
 assert.match(app,/App\.getLaunchUrl\(\)/);
 assert.match(manifest,/android:path="\/callback"/);
 assert.match(manifest,/android:screenOrientation/);
 assert.match(auth,/if\(mode==='web'\)redirect.searchParams.set\(OAUTH_STATE_PARAM,state\)/);
 assert.match(auth,/redirectBase:mode==='native'\?NATIVE_OAUTH_REDIRECT/);
});


test('generated Android activity hides only the top status bar and restores it after app focus',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const root=mkdtempSync(join(tmpdir(),'tower-android-viewport-'));
 try {
  const base=join(root,'android/app/src/main');
  const activityPath=join(base,'java/com/studio1524/towerchronicles/MainActivity.java');
  mkdirSync(join(base,'java/com/studio1524/towerchronicles'),{recursive:true});
  writeFileSync(join(base,'AndroidManifest.xml'),
   '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application>'+
   '<activity android:name=".MainActivity" android:exported="true"><intent-filter>'+
   '<action android:name="android.intent.action.MAIN"/></intent-filter></activity>'+
   '</application></manifest>');
  writeFileSync(activityPath,
   'package com.studio1524.towerchronicles;\n'+
   'import com.getcapacitor.BridgeActivity;\n'+
   'public class MainActivity extends BridgeActivity {}\n');
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/configure-android.mjs',import.meta.url))],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const activity=readFileSync(activityPath,'utf8');
  assert.match(activity,/bars\.hide\(WindowInsetsCompat\.Type\.statusBars\(\)\)/);
  assert.doesNotMatch(activity,/bars\.hide\(WindowInsetsCompat\.Type\.(?:systemBars|navigationBars)\(\)\)/);
  assert.match(activity,/onWindowFocusChanged\(boolean hasFocus\)/);
  assert.match(activity,/if \(hasFocus\) hideStatusBar\(\)/);
  assert.match(activity,/BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);
  const manifest=readFileSync(join(base,'AndroidManifest.xml'),'utf8');
  assert.match(manifest,/android:screenOrientation="portrait"/);
  assert.match(manifest,/android:scheme="towerchronicles"/);
  assert.match(manifest,/android.permission.INTERNET/);
 }finally{
  rmSync(root,{recursive:true,force:true});
 }
});
