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


// Immersive fullscreen: hide both Android system bars and lay the WebView edge-to-edge.
// This file is created by "npx cap add android" and is regenerated on each APK build.
const mainActivityPath='android/app/src/main/java/com/studio1524/towerchronicles/MainActivity.java';
const generatedActivity=readFileSync(mainActivityPath,'utf8');
if(!/^package com\.studio1524\.towerchronicles;/m.test(generatedActivity)||
   !/public class MainActivity extends BridgeActivity\s*\{\s*\}/m.test(generatedActivity)){
 throw Error('Unexpected generated Capacitor MainActivity; refused to overwrite custom native code');
}
const fullscreenActivity=String.raw`package com.studio1524.towerchronicles;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Native window color is dark even before the embedded game finishes drawing.
        getWindow().setBackgroundDrawableResource(android.R.color.black);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }
        applyImmersiveFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersiveFullscreen();
    }

    private void applyImmersiveFullscreen() {
        // Without this, hiding the bars leaves unused/white system inset bands.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }
}
`;
writeFileSync(mainActivityPath,fullscreenActivity);
console.log('Android configured: immersive edge-to-edge, both system bars hidden.');
