import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Print only summary counts, never matched values or raw subprocess errors.
const patterns = [
  /AIza[0-9A-Za-z_-]{35}/,
  /sb_(?:publishable|secret)_[A-Za-z0-9_-]{24,}/,
  /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const values = [];
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const containsSecret = text => patterns.some(pattern => pattern.test(text)) || values.some(value => text.includes(value));

try {
  if (process.argv.includes('--cloud')) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!/^[a-z][a-z0-9-]+$/.test(project || '')) throw new Error();
    const cli = process.env.GCLOUD_PATH || 'gcloud';
    const names = ['ONEMAP_ACCESS_TOKEN', 'LTA_ACCOUNT_KEY', 'GEMINI_API_KEY',
      ...(process.argv.includes('--without-community') ? [] : ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'])];
    for (const name of names) {
      const args = ['secrets', 'versions', 'access', 'latest', `--secret=${name}`, `--project=${project}`, '--quiet'];
      const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : cli;
      const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', `""${cli}" ${args.join(' ')}"`] : args;
      const value = execFileSync(command, commandArgs, { encoding: 'utf8', windowsVerbatimArguments: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      if (!value) throw new Error();
      values.push(value);
    }
  }
  let currentCount = 0;
  for (const path of git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)) {
    if (existsSync(path) && containsSecret(readFileSync(path, 'utf8'))) currentCount += 1;
  }
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
  let bundleCount = 0;
  for (const path of walk('dist')) {
    const text = readFileSync(path, 'utf8');
    if (containsSecret(text) || /AccountKey|x-goog-api-key|supabase\.co|generativelanguage\.googleapis\.com|onemap\.gov\.sg\/api|lta-proxy|gemini-proxy/.test(text)) bundleCount += 1;
  }
  let deployedCount = 0;
  if (process.env.TEST_BASE_URL) {
    const base = new URL(process.env.TEST_BASE_URL);
    if (base.protocol !== 'https:') throw new Error();
    const htmlResponse = await fetch(base, { signal: AbortSignal.timeout(30_000) });
    if (!htmlResponse.ok) throw new Error();
    const html = await htmlResponse.text();
    if (containsSecret(html)) deployedCount += 1;
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(match => match[1]))];
    if (!assets.some(path => path.endsWith('.js'))) throw new Error();
    for (const path of assets) {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error();
      if (containsSecret(await response.text())) deployedCount += 1;
    }
    console.log(`Deployed frontend findings=${deployedCount} (HTML and ${assets.length} assets checked).`);
  }
  // Inspect every reachable Git blob once. Secret values are never arguments.
  const ids = [...new Set(git('rev-list', '--objects', '--all').split('\n').filter(Boolean).map(line => line.split(' ')[0]))];
  const batch = execFileSync('git', ['cat-file', '--batch'], { input: ids.join('\n') + '\n', maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  let offset = 0;
  let historyCount = 0;
  let blobs = 0;
  while (offset < batch.length) {
    const end = batch.indexOf(10, offset);
    if (end < 0) break;
    const [, type, sizeText] = batch.subarray(offset, end).toString().split(' ');
    const size = Number(sizeText);
    if (!Number.isFinite(size)) throw new Error();
    if (type === 'blob') {
      blobs += 1;
      if (containsSecret(batch.subarray(end + 1, end + 1 + size).toString('utf8'))) historyCount += 1;
    }
    offset = end + 1 + size + 1;
  }
  console.log(`Secret audit: worktree findings=${currentCount}, frontend findings=${bundleCount}, history findings=${historyCount} (${blobs} Git blobs checked).`);
  console.log(values.length ? `Compared ${values.length} actual Secret Manager values in memory; no values printed.` : 'Pattern scan only; use --cloud to additionally compare actual Secret Manager values.');
  if (currentCount || bundleCount || historyCount || deployedCount) process.exitCode = 1;
} catch {
  console.error('Secret audit could not complete. Verify Git, build output, and cloud access if requested. No secret values or subprocess output were printed.');
  process.exitCode = 1;
}
