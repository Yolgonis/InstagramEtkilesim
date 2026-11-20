// Bağımlılıksız derleme: src/ içindeki script'i public/index.html şablonuna gömer, dist/ klasörüne yazar.
// Kullanım: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = readFileSync(join(root, 'src', 'instagram-etkilesim.js'), 'utf8');
const template = readFileSync(join(root, 'public', 'index.html'), 'utf8');

const repo = process.env.GITHUB_REPOSITORY; // GitHub Actions'ta "kullanici/repo"
const repoUrl = repo ? `https://github.com/${repo}` : 'https://github.com/';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = template
  .split('__SCRIPT__').join(escapeHtml(script))
  .split('__REPO_URL__').join(repoUrl);

const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), html);
writeFileSync(join(dist, 'instagram-etkilesim.js'), script);

// Teşhis aracı: Instagram'ın kendi isteklerini kaydeden ayrı sayfa.
const recorder = readFileSync(join(root, 'src', 'ag-kaydedici.js'), 'utf8');
const recorderPage = readFileSync(join(root, 'public', 'kaydedici.html'), 'utf8');
writeFileSync(join(dist, 'kaydedici.html'), recorderPage.split('__SCRIPT__').join(escapeHtml(recorder)));
writeFileSync(join(dist, 'ag-kaydedici.js'), recorder);
console.log('dist/index.html, dist/kaydedici.html ve script dosyaları oluşturuldu.');
