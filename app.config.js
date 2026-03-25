const fs = require('fs');
const path = require('path');

// Parse .env file
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      env[key.trim()] = rest.join('=').trim();
    }
  } catch {}
  return env;
}

const env = loadEnv();

const sentryPlugin = env.SENTRY_ORG && env.SENTRY_PROJECT
  ? [['@sentry/react-native/expo', { organization: env.SENTRY_ORG, project: env.SENTRY_PROJECT }]]
  : [['@sentry/react-native/expo', { organization: 'dummy', project: 'dummy', uploadSourceMaps: false }]];

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    ...sentryPlugin,
    'expo-sharing',
    'expo-web-browser',
  ],
  extra: {
    ...config.extra,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || '',
    SUPABASE_URL: env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || '',
    SENTRY_DSN: env.SENTRY_DSN || '',
  },
});
