const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'www');
const target = path.join(root, 'dist');

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const orgId = process.env.ENGERAMA_ORG_ID || '00000000-0000-4000-8000-000000000001';

fs.writeFileSync(path.join(target, 'app-config.js'), `window.ENGERAMA_CONFIG = {
  apiBaseUrl: '',
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
  orgId: ${JSON.stringify(orgId)},
  offlineSyncIntervalMs: 15000,
  enablePush: false,
  appVersion: '1.0.0'
};
`);

console.log('Vercel build pronto em dist/');
