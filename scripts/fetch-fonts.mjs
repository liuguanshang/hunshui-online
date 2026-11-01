// 构建时下载页面用到的字体（只取页面里出现过的字，文件很小），存到 public/fonts。
// 下载失败也不会影响运行，页面会退回系统字体。
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public', 'fonts');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
try {
  const html = await fs.readFile(path.join(root, 'public', 'index.html'), 'utf8');
  const chars = [...new Set([...html].filter(ch => ch.codePointAt(0) >= 0x20))].join('') + '0123456789';
  const fams = ['Ma+Shan+Zheng', 'ZCOOL+KuaiLe', 'Rubik:wght@700;800'].map(f => 'family=' + f).join('&');
  const url = `https://fonts.googleapis.com/css2?${fams}&text=${encodeURIComponent(chars)}&display=swap`;
  let css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  if (!css.includes('@font-face')) throw new Error('no @font-face in response');
  await fs.mkdir(out, { recursive: true });
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))];
  let i = 0;
  for (const u of urls){
    const name = `f${i++}.woff2`;
    const buf = Buffer.from(await (await fetch(u, { headers: { 'User-Agent': UA } })).arrayBuffer());
    await fs.writeFile(path.join(out, name), buf);
    css = css.split(u).join(name);
  }
  await fs.writeFile(path.join(out, 'fonts.css'), css);
  console.log(`fonts: saved ${urls.length} files`);
} catch (e){
  console.warn('fonts: download skipped (' + e.message + '), page will use system fonts');
  try { await fs.mkdir(out, { recursive: true }); await fs.access(path.join(out, 'fonts.css')); } catch { await fs.writeFile(path.join(out, 'fonts.css'), '/* fonts unavailable */\n'); }
}
