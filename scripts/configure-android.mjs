import {readFileSync,writeFileSync} from 'node:fs';

const path='android/app/src/main/AndroidManifest.xml';
let xml=readFileSync(path,'utf8');
const activityStart=xml.indexOf('<activity');
const tagEnd=xml.indexOf('>',activityStart);
const activityEnd=xml.indexOf('</activity>',tagEnd);
if(activityStart<0||tagEnd<0||activityEnd<0)throw Error('Capacitor Android MainActivity not found');
const opening=xml.slice(activityStart,tagEnd);
if(!opening.includes('android:screenOrientation=')){
 xml=xml.slice(0,tagEnd)+' android:screenOrientation="portrait"'+xml.slice(tagEnd);
}
if(!xml.includes('android:scheme="towerchronicles"')){
 const end=xml.indexOf('</activity>',xml.indexOf('<activity'));
 const filter=[
  '        <!-- Supabase Google OAuth callback: external browser -> installed app -->',
  '        <intent-filter>',
  '            <action android:name="android.intent.action.VIEW" />',
  '            <category android:name="android.intent.category.DEFAULT" />',
  '            <category android:name="android.intent.category.BROWSABLE" />',
  '            <data android:scheme="towerchronicles" android:host="auth" android:path="/callback" />',
  '        </intent-filter>',
 ].join('\n');
 xml=xml.slice(0,end)+filter+'\n    '+xml.slice(end);
}
if(!xml.includes('android.permission.INTERNET')){
 xml=xml.replace('</manifest>','    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>');
}
writeFileSync(path,xml);
console.log('Android configured: portrait, Internet, and scoped OAuth callback intent-filter.');
