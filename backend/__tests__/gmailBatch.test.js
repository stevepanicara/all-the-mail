import { _parseMultipart } from '../lib/gmailBatch.js';

// Direct parser tests. The previous version of this file mocked `https`
// to drive batchGetMessages end-to-end; the parser is the only piece of
// non-trivial logic in the module, so testing it directly drops the
// fragile mocking dance and runs in <1ms.

const BOUNDARY = 'response_xyz_abc123';

// Build a representative Gmail batch response body. Format documented at
// https://developers.google.com/gmail/api/guides/batch.
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

describe('_parseMultipart', () => {
  test('parses 3 successful sub-responses into ordered results', () => {
    const body = fakeMultipartResponse([
      { json: { id: 'a', threadId: 't1', snippet: 'first' } },
      { json: { id: 'b', threadId: 't2', snippet: 'second' } },
      { json: { id: 'c', threadId: 't3', snippet: 'third' } },
    ]);
    const out = _parseMultipart(body, BOUNDARY, 3);
    expect(out).toHaveLength(3);
    expect(out[0]?.id).toBe('a');
    expect(out[1]?.id).toBe('b');
    expect(out[2]?.id).toBe('c');
  });

  test('returns null at the failing index for non-2xx sub-responses', () => {
    const body = fakeMultipartResponse([
      { json: { id: 'a' } },
      { status: 404, statusText: 'Not Found', body: '{"error":"not found"}' },
      { json: { id: 'c' } },
    ]);
    const out = _parseMultipart(body, BOUNDARY, 3);
    expect(out).toHaveLength(3);
    expect(out[0]?.id).toBe('a');
    expect(out[1]).toBeNull();
    expect(out[2]?.id).toBe('c');
  });

  test('respects the count argument when sections exceed it', () => {
    // Synthetic edge: count smaller than what the body contains.
    // The parser should not write past out.length.
    const body = fakeMultipartResponse([
      { json: { id: 'a' } },
      { json: { id: 'b' } },
      { json: { id: 'c' } },
    ]);
    const out = _parseMultipart(body, BOUNDARY, 2);
    expect(out).toHaveLength(2);
    expect(out[0]?.id).toBe('a');
    expect(out[1]?.id).toBe('b');
  });

  test('returns all-null when the body is empty', () => {
    const out = _parseMultipart('', BOUNDARY, 5);
    expect(out).toHaveLength(5);
    expect(out.every(v => v === null)).toBe(true);
  });

  test('returns null for a section with no inner-body separator', () => {
    // Malformed: outer headers but the inner HTTP block is missing the
    // \r\n\r\n that separates inner headers from body.
    const malformed =
      `--${BOUNDARY}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-ID: <response-item-0>\r\n` +
      `\r\n` +
      `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n` + // no \r\n\r\n
      `{"id":"a"}\r\n` +
      `--${BOUNDARY}--\r\n`;
    const out = _parseMultipart(malformed, BOUNDARY, 1);
    expect(out).toEqual([null]);
  });

  test('handles JSON parse failures by returning null', () => {
    const body =
      `--${BOUNDARY}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-ID: <response-item-0>\r\n` +
      `\r\n` +
      `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n` +
      `{ this is not json }\r\n` +
      `--${BOUNDARY}--\r\n`;
    const out = _parseMultipart(body, BOUNDARY, 1);
    expect(out).toEqual([null]);
  });
});
