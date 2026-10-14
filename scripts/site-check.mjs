import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const entries = fs.readdirSync(root, { withFileTypes: true });
const htmlFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith('.html')).map(entry => entry.name);
const failures = [];

function existsLocalPath(raw, fromFile) {
  let value;
  try { value = decodeURIComponent(raw.split(/[?#]/, 1)[0]); }
  catch { return false; }
  if (!value || value.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return true;
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('javascript:')) return true;
  const base = value.startsWith('/') ? root : path.dirname(path.join(root, fromFile));
  let target = path.resolve(base, value.replace(/^\/+/, ''));
  if (value.startsWith('/')) target = path.resolve(root, value.replace(/^\/+/, ''));
  if (value.endsWith('/')) target = path.join(target, 'index.html');
  return target === root || target.startsWith(root + path.sep) ? fs.existsSync(target) : false;
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  if (!html.includes('/site-wide.css')) failures.push(file + ': missing shared site-wide stylesheet');
  const attrs = /\b(?:src|href|poster)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attrs)) {
    const ref = match[1].trim();
    if (!existsLocalPath(ref, file)) failures.push(file + ': missing local asset/link ' + ref);
  }
}

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
for (const required of ['/site-wide.css', '/competitive-lab.html', '/competitive-lab.js', '/minigames.html', '/music.html']) {
  if (!sw.includes(required)) failures.push('sw.js: offline shell missing ' + required);
}
const hub = fs.readFileSync(path.join(root, 'arcade-hub.html'), 'utf8');
const mini = fs.readFileSync(path.join(root, 'minigames.html'), 'utf8');
if (!hub.includes('30 Mini-Games') || !mini.includes('30 Mini-Games')) failures.push('Mini-game count differs between arcade hub and mini-games page');

if (failures.length) {
  console.error('Site checks failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Site checks passed: ' + htmlFiles.length + ' HTML pages, local assets/links, shared styling, offline shell, and mini-game count.');
