interface ResilientFetchOptions extends RequestInit {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Max retry attempts on transient failures (default: 2) */
  maxRetries?: number;
  /** Base delay between retries in ms, doubles each attempt (default: 1000) */
  retryDelayMs?: number;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 30000,
    maxRetries = 2,
    retryDelayMs = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Merge abort signal — if caller provided one, respect both
    const signal = options.signal
      ? anySignal([options.signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(url, { ...fetchOptions, signal });
      clearTimeout(timeoutId);

      // Don't retry on success or permanent client errors
      if (response.ok || (!isRetryableStatus(response.status) && response.status < 500)) {
        return response;
      }

      // Retryable server/rate-limit error
      if (attempt < maxRetries && isRetryableStatus(response.status)) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      // Out of retries — return the error response for caller to handle
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // If the caller's signal aborted, don't retry
      if (options.signal?.aborted) {
        throw error;
      }

      // Timeout or network error — retry if we have attempts left
      if (attempt < maxRetries) {
        lastError = error;
        const delay = retryDelayMs * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      // Out of retries
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
