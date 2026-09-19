import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export const SECRET_NAMES = [
  'ONEMAP_ACCESS_TOKEN', 'LTA_ACCOUNT_KEY', 'GEMINI_API_KEY',
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY',
];

// Cloud Run uses its attached service account. Local development uses ADC.
// No credential values are read from env files or sent to clients.
export function createSecretReader() {
  const client = new SecretManagerServiceClient();
  const cache = new Map();
  const pending = new Map();
  return async function readSecret(name) {
    if (!SECRET_NAMES.includes(name)) throw new Error('Unknown integration');
    if (cache.get(name)?.expires > Date.now()) return cache.get(name).value;
    if (pending.has(name)) return pending.get(name);
    const request = (async () => {
      try {
        const project = process.env.GOOGLE_CLOUD_PROJECT || await client.getProjectId();
        const [version] = await client.accessSecretVersion({
          name: `projects/${project}/secrets/${name}/versions/latest`,
        });
        const value = version.payload?.data?.toString('utf8').trim();
        if (!value) throw new Error('Empty integration configuration');
        cache.set(name, { value, expires: Date.now() + 300_000 });
        return value;
      } catch {
        // SDK errors may include project/resource details. Never forward or log them.
        throw new Error('Integration configuration unavailable');
      }
    })();
    pending.set(name, request);
    try { return await request; } finally { pending.delete(name); }
  };
}
