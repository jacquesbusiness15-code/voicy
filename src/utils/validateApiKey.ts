import { resilientFetch } from './resilientFetch';

export async function validateApiKey(
  provider: 'openai' | 'anthropic' | 'deepl' | 'assemblyai',
  key: string
): Promise<{ valid: boolean; error?: string }> {
  if (!key.trim()) return { valid: false, error: 'API key cannot be empty.' };

  try {
    switch (provider) {
      case 'openai': {
        const res = await resilientFetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          timeoutMs: 10000,
          maxRetries: 0,
        });
        if (res.ok) return { valid: true };
        if (res.status === 401) return { valid: false, error: 'Invalid API key.' };
        return { valid: false, error: `OpenAI returned status ${res.status}.` };
      }

      case 'anthropic': {
        const res = await resilientFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
          timeoutMs: 15000,
          maxRetries: 0,
        });
        if (res.ok) return { valid: true };
        if (res.status === 401) return { valid: false, error: 'Invalid API key.' };
        // 400 means key is valid but request was bad (unlikely with our payload but still valid key)
        if (res.status === 400) return { valid: true };
        return { valid: false, error: `Anthropic returned status ${res.status}.` };
      }

      case 'deepl': {
        const res = await resilientFetch('https://api-free.deepl.com/v2/usage', {
          headers: { Authorization: `DeepL-Auth-Key ${key}` },
          timeoutMs: 10000,
          maxRetries: 0,
        });
        if (res.ok) return { valid: true };
        if (res.status === 403) return { valid: false, error: 'Invalid API key.' };
        return { valid: false, error: `DeepL returned status ${res.status}.` };
      }

      case 'assemblyai': {
        const res = await resilientFetch('https://api.assemblyai.com/v2/transcript?limit=1', {
          headers: { Authorization: key },
          timeoutMs: 10000,
          maxRetries: 0,
        });
        if (res.ok) return { valid: true };
        if (res.status === 401) return { valid: false, error: 'Invalid API key.' };
        return { valid: false, error: `AssemblyAI returned status ${res.status}.` };
      }
    }
  } catch (e: any) {
    return { valid: false, error: e.message || 'Connection failed.' };
  }
}
