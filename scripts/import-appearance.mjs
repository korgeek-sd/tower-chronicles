import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Tower Chronicles 외형(Appearance) 이미지 자동 변환 및 카탈로그 등록 CLI
 *
 * 사용법:
 *   node scripts/import-appearance.mjs <appearance-id> <image-file-path>
 *
 * 예시:
 *   node scripts/import-appearance.mjs corsair C:/path/to/image.jpg
 */

async function main() {
  const [appearanceId, inputPath] = process.argv.slice(2);

  if (!appearanceId || !inputPath) {
    console.error('사용법: node scripts/import-appearance.mjs <appearance-id> <image-path>');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`입력 파일이 존재하지 않습니다: ${resolvedInput}`);
    process.exit(1);
  }

  const edgeCandidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const browserExe = edgeCandidates.find(p => fs.existsSync(p));
  if (!browserExe) {
    console.error('Edge 또는 Chrome 브라우저 실행 파일을 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`[1/5] 이미지 로딩 및 브라우저 프로세스 시작 (${path.basename(browserExe)})...`);
  const port = 9222 + Math.floor(Math.random() * 500);
  const browser = spawn(browserExe, [
    '--headless',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  try {
    let targetWsUrl = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json`);
        const pages = await res.json();
        const page = pages.find(p => p.type === 'page');
        if (page?.webSocketDebuggerUrl) {
          targetWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {
        // waiting for port to open
      }
    }

    if (!targetWsUrl) {
      throw new Error(`CDP 포트 ${port}에 연결할 수 없습니다.`);
    }

    const ws = new WebSocket(targetWsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    function send(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    console.log('[2/5] 외곽 검은 배경 투명화 및 1024x1024 WebP 변환 중...');
    const inputBuf = fs.readFileSync(resolvedInput);
    const ext = path.extname(resolvedInput).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const img = new Image();
          img.src = 'data:${mime};base64,${inputBuf.toString('base64')}';
          await img.decode();
          const w = 1024, h = 1024;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          const isBlack = (x, y) => {
            if (x < 0 || x >= w || y < 0 || y >= h) return false;
            const i = (y * w + x) * 4;
            // 완전히 어두운 픽셀 (노이즈 포함 threshold <= 6)
            return data[i] <= 6 && data[i+1] <= 6 && data[i+2] <= 6 && data[i+3] > 0;
          };

          const visited = new Uint8Array(w * h);
          const queue = new Int32Array(w * h * 2);
          let head = 0, tail = 0;

          const push = (x, y) => {
            const idx = y * w + x;
            if (!visited[idx] && isBlack(x, y)) {
              visited[idx] = 1;
              queue[tail++] = x;
              queue[tail++] = y;
            }
          };

          // 4변 가장자리에서 큐 시작
          for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
          for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

          // 8방향 Flood Fill BFS
          while (head < tail) {
            const cx = queue[head++];
            const cy = queue[head++];
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                if (dx !== 0 || dy !== 0) {
                  push(cx + dx, cy + dy);
                }
              }
            }
          }

          // 외곽과 연결된 검은 배경만 알파 = 0으로 변환
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              if (visited[idx]) {
                const p = idx * 4;
                data[p] = 0;
                data[p + 1] = 0;
                data[p + 2] = 0;
                data[p + 3] = 0;
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          return c.toDataURL('image/webp', 0.95);
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    ws.close();

    const dataUrl = evalRes.result.value;
    const base64Data = dataUrl.replace(/^data:image\/webp;base64,/, '');
    const webpBuf = Buffer.from(base64Data, 'base64');

    console.log('[3/5] SHA-256 해시 계산 및 새 WebP 파일 저장...');
    const hash = crypto.createHash('sha256').update(webpBuf).digest('hex').slice(0, 12);
    const newFileName = `${appearanceId}-${hash}.webp`;
    const appearanceDir = path.resolve('public/assets/characters/appearances');
    const newFilePath = path.join(appearanceDir, newFileName);

    // 이전 버전 외형 파일 검색 및 삭제
    const oldFiles = fs.readdirSync(appearanceDir).filter(f => f.startsWith(`${appearanceId}-`) && f.endsWith('.webp') && f !== newFileName);
    for (const oldFile of oldFiles) {
      const oldPath = path.join(appearanceDir, oldFile);
      fs.unlinkSync(oldPath);
      console.log(`  - 구버전 파일 삭제됨: ${oldFile}`);
    }

    fs.writeFileSync(newFilePath, webpBuf);
    console.log(`  + 새 외형 파일 생성됨: ${newFileName} (${webpBuf.length.toLocaleString()} bytes)`);

    // 동일 ID의 직업 일러스트가 존재하는 경우 함께 동기화
    const jobFilePath = path.resolve(`public/assets/characters/jobs/${appearanceId}.webp`);
    if (fs.existsSync(jobFilePath)) {
      fs.writeFileSync(jobFilePath, webpBuf);
      console.log(`  + 직업 일러스트 동기화됨: public/assets/characters/jobs/${appearanceId}.webp`);
    }

    console.log('[4/5] src/game/data/cosmetics.ts 카탈로그 자동 업데이트...');
    const cosmeticsPath = path.resolve('src/game/data/cosmetics.ts');
    let cosmeticsContent = fs.readFileSync(cosmeticsPath, 'utf8');

    // id:'corsair' 또는 id:"corsair" 블록 내 imagePath 교체
    const regex = new RegExp(`(id:\\s*['"]${appearanceId}['"][\\s\\S]*?imagePath:\\s*['"])(assets/characters/appearances/${appearanceId}-[a-f0-9]{12}\\.webp)(['"])`, 'g');
    if (regex.test(cosmeticsContent)) {
      cosmeticsContent = cosmeticsContent.replace(regex, `$1assets/characters/appearances/${newFileName}$3`);
      fs.writeFileSync(cosmeticsPath, cosmeticsContent, 'utf8');
      console.log(`  + cosmetics.ts imagePath -> assets/characters/appearances/${newFileName}`);
    } else {
      console.warn(`  ! 주의: cosmetics.ts에서 '${appearanceId}'의 기존 appearances imagePath 패턴을 찾지 못했습니다. 수동 확인이 필요할 수 있습니다.`);
    }

    console.log('[5/5] 완료!');
    console.log(`\n🎉 외형 '${appearanceId}' 이미지가 성공적으로 갱신되었습니다.`);
    console.log(`- 파일: public/assets/characters/appearances/${newFileName}`);
    console.log(`- 해시: ${hash}`);
    console.log(`\n다음 단계 권장:`);
    console.log(`1. node --import ./tests/register.mjs --test tests/appearanceCatalog.test.ts`);
    console.log(`2. git add -A && git commit -m "feat(cosmetics): update ${appearanceId} appearance artwork"`);
    console.log(`3. git push origin main`);

  } finally {
    try { browser.kill(); } catch {}
  }
}

main().catch(err => {
  console.error('오류 발생:', err);
  process.exit(1);
});
