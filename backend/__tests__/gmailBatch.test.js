import { jest } from '@jest/globals';

// We can't easily test the live HTTPS request, but we can validate the
// multipart response parser — the only non-trivial logic in this module
// and the place a bug would silently swallow real Gmail data.

const BOUNDARY = 'response_xyz_abc123';

// Helper that builds a representative Gmail batch response body so we can
// run the parser against shapes Gmail actually returns. The format is
// documented at https://developers.google.com/gmail/api/guides/batch.
function fakeMultipartResponse(parts, boundary = BOUNDARY) {
  const sections = parts.map((part, i) => {
    const inner = part.json
      ? `HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=UTF-8\r\nContent-Length: ${JSON.stringify(part.json).length}\r\n\r\n${JSON.stringify(part.json)}\r\n`
      : `HTTP/1.1 ${part.status || 500} ${part.statusText || 'Error'}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${part.body || '{}'}\r\n`;
    return (
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-ID: <response-item-${i}>\r\n` +
      `\r\n` +
      inner
    );
  });
  return sections.join('') + `--${boundary}--\r\n`;
}

describe('Gmail batch parser', () => {
  beforeEach(() => {
    // jest.unstable_mockModule only takes effect for modules imported
    // AFTER the mock is registered. Reset the module registry between
    // tests so each test's dynamic import sees its own mock.
    jest.resetModules();
  });

  test('parses a 3-message successful batch into ordered results', async () => {
    // Mock the https module so batchGetMessages doesn't make a real request.
    jest.unstable_mockModule('https', () => ({
      default: {
        request: (opts, cb) => {
          // Build a response object that mimics Node's http.IncomingMessage
          const body = fakeMultipartResponse([
            { json: { id: 'a', threadId: 't1', snippet: 'first' } },
            { json: { id: 'b', threadId: 't2', snippet: 'second' } },
            { json: { id: 'c', threadId: 't3', snippet: 'third' } },
          ]);
          const handlers = {};
          const res = {
            statusCode: 200,
            headers: { 'content-type': `multipart/mixed; boundary=${BOUNDARY}` },
            on: (event, h) => { handlers[event] = h; return res; },
          };
          // Invoke the callback synchronously so the test resolves quickly
          process.nextTick(() => {
            cb(res);
            handlers.data?.(Buffer.from(body, 'utf8'));
            handlers.end?.();
          });
          return {
            on: () => {},
            write: () => {},
            end: () => {},
            setTimeout: () => {},
            destroy: () => {},
          };
        },
      },
    }));

    // Re-import after mock so the module sees the mock
    const { batchGetMessages } = await import('../lib/gmailBatch.js');
    const fakeClient = {
      getAccessToken: async () => ({ token: 'fake-token' }),
    };
    const out = await batchGetMessages(fakeClient, ['a', 'b', 'c'], { format: 'metadata' });
    expect(out).toHaveLength(3);
    expect(out[0]?.id).toBe('a');
    expect(out[1]?.id).toBe('b');
    expect(out[2]?.id).toBe('c');
  });

  test('returns null for individual sub-request failures', async () => {
    jest.unstable_mockModule('https', () => ({
      default: {
        request: (opts, cb) => {
          const body = fakeMultipartResponse([
            { json: { id: 'a' } },
            { status: 404, statusText: 'Not Found', body: '{"error":"not found"}' },
            { json: { id: 'c' } },
          ]);
          const handlers = {};
          const res = {
            statusCode: 200,
            headers: { 'content-type': `multipart/mixed; boundary=${BOUNDARY}` },
            on: (event, h) => { handlers[event] = h; return res; },
          };
          process.nextTick(() => {
            cb(res);
            handlers.data?.(Buffer.from(body, 'utf8'));
            handlers.end?.();
          });
          return { on: () => {}, write: () => {}, end: () => {}, setTimeout: () => {}, destroy: () => {} };
        },
      },
    }));
    const { batchGetMessages } = await import('../lib/gmailBatch.js');
    const fakeClient = { getAccessToken: async () => ({ token: 'fake-token' }) };
    const out = await batchGetMessages(fakeClient, ['a', 'b', 'c'], { format: 'metadata' });
    expect(out).toHaveLength(3);
    expect(out[0]?.id).toBe('a');
    expect(out[1]).toBeNull();
    expect(out[2]?.id).toBe('c');
  });

  test('splits batches >100 messages into chunks of 100', async () => {
    let callCount = 0;
    jest.unstable_mockModule('https', () => ({
      default: {
        request: (opts, cb) => {
          callCount++;
          // Each chunk is 100 (or fewer for the tail). We don't actually need
          // to count incoming-batch sizes; just confirm two HTTP calls were
          // made for a 150-id input.
          const body = fakeMultipartResponse(
            Array.from({ length: 100 }, (_, i) => ({ json: { id: `msg-${callCount}-${i}` } }))
          );
          const handlers = {};
          const res = {
            statusCode: 200,
            headers: { 'content-type': `multipart/mixed; boundary=${BOUNDARY}` },
            on: (event, h) => { handlers[event] = h; return res; },
          };
          process.nextTick(() => {
            cb(res);
            handlers.data?.(Buffer.from(body, 'utf8'));
            handlers.end?.();
          });
          return { on: () => {}, write: () => {}, end: () => {}, setTimeout: () => {}, destroy: () => {} };
        },
      },
    }));
    const { batchGetMessages } = await import('../lib/gmailBatch.js');
    const fakeClient = { getAccessToken: async () => ({ token: 'fake-token' }) };
    const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`);
    const out = await batchGetMessages(fakeClient, ids, { format: 'metadata' });
    // We made 2 HTTP requests (chunked at 100). Result count is whatever
    // the mock returned per chunk — what we're really testing is "more
    // than one transport call made for >100 ids".
    expect(callCount).toBe(2);
    expect(out.length).toBeGreaterThan(0);
  });
});
