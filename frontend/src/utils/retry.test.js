import { fetchWithRetry } from './retry';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('returns response on successful first try', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry('/api/test', {}, { maxRetries: 3, baseDelay: 1 });
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 error and succeeds on second try', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry('/api/test', {}, { maxRetries: 3, baseDelay: 1 });
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxRetries and returns last 500 response', async () => {
    const serverError = { ok: false, status: 500 };
    global.fetch.mockResolvedValue(serverError);

    const result = await fetchWithRetry('/api/test', {}, { maxRetries: 2, baseDelay: 1 });
    expect(result.status).toBe(500);
    expect(global.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry on 4xx errors', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchWithRetry('/api/test', {}, { maxRetries: 3, baseDelay: 1 });
    expect(result.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 401 errors', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await fetchWithRetry('/api/test', {}, { maxRetries: 3, baseDelay: 1 });
    expect(result.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on network error and throws after maxRetries', async () => {
    const networkError = new Error('Network failure');
    global.fetch.mockRejectedValue(networkError);

    await expect(
      fetchWithRetry('/api/test', {}, { maxRetries: 2, baseDelay: 1 })
    ).rejects.toThrow('Network failure');
    expect(global.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('recovers from network error on retry', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await fetchWithRetry('/api/test', {}, { maxRetries: 3, baseDelay: 1 });
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('passes url and options to fetch', async () => {
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await fetchWithRetry('/api/test', options, { maxRetries: 1, baseDelay: 1 });
    expect(global.fetch).toHaveBeenCalledWith('/api/test', options);
  });
});
