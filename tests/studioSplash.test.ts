import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const expectedDurationMs=6000;
const video=readFileSync(new URL('../public/assets/studio0322/splash.mp4',import.meta.url));

test('startup ships the selected six-second portrait cinematic',()=>{
  const movie=video.indexOf(Buffer.from('mvhd'));
  assert.ok(movie>=4,'the intro must be a playable MP4 movie');
  const version=video[movie+4];
  const timescale=video.readUInt32BE(movie+(version===1?24:16));
  const duration=version===1?Number(video.readBigUInt64BE(movie+28)):video.readUInt32BE(movie+20);
  assert.equal(duration/timescale*1000,expectedDurationMs,'the complete selected intro must be included');

  const track=video.indexOf(Buffer.from('tkhd'));
  assert.ok(track>=4,'the intro must include a video track');
  const end=track-4+video.readUInt32BE(track-4);
  assert.equal(video.readUInt32BE(end-8)/65536,1080);
  assert.equal(video.readUInt32BE(end-4)/65536,2304);
});

test('startup safety timeout leaves loading time before the complete intro and remains bounded',()=>{
  const source=readFileSync(new URL('../src/components/splash/Studio0322Splash.tsx',import.meta.url),'utf8');
  const wait=Number(source.match(/const MAX_WAIT_MS\s*=\s*(\d+)/)?.[1]);
  assert.ok(wait>=expectedDurationMs+2000,'the safety timeout must not cut the selected six-second intro short');
  assert.ok(wait<=12000,'a failed video must not block game entry indefinitely');
});
