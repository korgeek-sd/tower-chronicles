import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

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
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          // 모서리 픽셀들 샘플링하여 배경 유형 자동 판별
          const sampleIndices = [0, w - 1, (h - 1) * w, (h - 1) * w + (w - 1)];
          const sampleAlphas = sampleIndices.map(idx => data[idx * 4 + 3]);
          const isAlreadyTransparent = sampleAlphas.every(a => a === 0);

          if (!isAlreadyTransparent) {
            // 모서리 색상 평균 계산
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (const idx of sampleIndices) {
              if (data[idx * 4 + 3] > 0) {
                rSum += data[idx * 4];
                gSum += data[idx * 4 + 1];
                bSum += data[idx * 4 + 2];
                count++;
              }
            }
            const bgR = count ? rSum / count : 0;
            const bgG = count ? gSum / count : 0;
            const bgB = count ? bSum / count : 0;

            const isBgPixel = (x, y) => {
              if (x < 0 || x >= w || y < 0 || y >= h) return false;
              const i = (y * w + x) * 4;
              if (data[i + 3] === 0) return true; // 이미 투명하면 통과
              const dr = Math.abs(data[i] - bgR);
              const dg = Math.abs(data[i + 1] - bgG);
              const db = Math.abs(data[i + 2] - bgB);
              return dr <= 8 && dg <= 8 && db <= 8;
            };

            const visited = new Uint8Array(w * h);
            const queue = new Int32Array(w * h * 2);
            let head = 0, tail = 0;

            const push = (x, y) => {
              const idx = y * w + x;
              if (!visited[idx] && isBgPixel(x, y)) {
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

            // 외곽과 연결된 배경만 알파 = 0으로 변환
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

    // Retain previous hashed files: old deployments and concurrent PRs can still reference them.
    // Cleanup is a separate, reference-checked maintenance task.

    fs.writeFileSync(newFilePath, webpBuf);
    console.log(`  + 새 외형 파일 생성됨: ${newFileName} (${webpBuf.length.toLocaleString()} bytes)`);

    // A cosmetic update must never overwrite a job-specific character portrait.

    console.log('[4/5] src/game/data/cosmetics.ts 카탈로그 자동 업데이트...');
    const cosmeticsPath = path.resolve('src/game/data/cosmetics.ts');
    let cosmeticsContent = fs.readFileSync(cosmeticsPath, 'utf8');

    // Use the TypeScript syntax tree to update only the selected entry.
    // A wide regex could accidentally update a neighboring appearance.
    const source = ts.createSourceFile('cosmetics.ts', cosmeticsContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let imageValue = null;
    const visit = (node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const props = node.properties.filter(ts.isPropertyAssignment);
        const idProp = props.find(p => ts.isIdentifier(p.name) && p.name.text === 'id');
        if (idProp?.initializer && ts.isStringLiteral(idProp.initializer) && idProp.initializer.text === appearanceId) {
          const imageProp = props.find(p => ts.isIdentifier(p.name) && p.name.text === 'imagePath');
          if (!imageProp?.initializer || !ts.isStringLiteral(imageProp.initializer)) {
            throw new Error('Existing appearance imagePath was not found for: ' + appearanceId);
          }
          if (imageValue) throw new Error('Duplicate appearance ID: ' + appearanceId);
          imageValue = imageProp.initializer;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (!imageValue) throw new Error('Appearance ID not found in catalog: ' + appearanceId);
    if (!imageValue.text.startsWith('assets/characters/appearances/' + appearanceId + '-')) {
      throw new Error('Unexpected current artwork path; refusing to update another appearance');
    }
    const quote = imageValue.getText(source)[0];
    const nextPath = 'assets/characters/appearances/' + newFileName;
    cosmeticsContent =
      cosmeticsContent.slice(0, imageValue.getStart(source)) +
      quote + nextPath + quote +
      cosmeticsContent.slice(imageValue.end);
    fs.writeFileSync(cosmeticsPath, cosmeticsContent, 'utf8');
    console.log('  + cosmetics.ts imagePath -> ' + nextPath);

    console.log('[5/5] 완료!');
    console.log(`\n🎉 외형 '${appearanceId}' 이미지가 성공적으로 갱신되었습니다.`);
    console.log(`- 파일: public/assets/characters/appearances/${newFileName}`);
    console.log(`- 해시: ${hash}`);
    console.log(`\n다음 단계 권장:`);
    console.log(`1. node --import ./tests/register.mjs --test tests/appearanceCatalog.test.ts`);
    console.log(`2. git add -A && git commit -m "feat(cosmetics): update ${appearanceId} appearance artwork"`);
    console.log(`3. git push origin HEAD && gh pr create --base main --label skin-ready`);

  } finally {
    try { browser.kill(); } catch {}
  }
}

main().catch(err => {
  console.error('오류 발생:', err);
  process.exit(1);
});
