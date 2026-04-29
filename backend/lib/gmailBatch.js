// Gmail batch HTTP request helper. The googleapis Node SDK doesn't expose
// the /batch/gmail/v1 endpoint, so we hand-roll the multipart/mixed
// request and parse the multipart response.
//
// Why: messages.get fan-out is the dominant latency on inbox load. With
// 50 messages and the per-account-per-second quota cap (~250 units),
// concurrency-25 takes ~2 sequential rounds (~400-800ms). A single
// batch request collapses that to one round-trip (~200-400ms) and
// counts as a single quota check.
//
// Reference: https://developers.google.com/gmail/api/guides/batch
//
// Limitations Gmail enforces:
//   - max 100 sub-requests per batch
//   - all sub-requests must be against the same API
//   - global rate limit still applies; this doesn't bypass quota
//
// Usage:
//   const client = await getOAuth2ClientForAccount(accountId, userId);
//   const items = await batchGetMessages(client, messageIds, {
//     format: 'metadata',
//     metadataHeaders: ['From', 'Subject', 'Date', 'Content-Type'],
//   });
//   // items is parallel to messageIds; each element is the parsed Gmail
//   // message JSON (or null if that sub-request failed).

import https from 'https';

const BATCH_URL = 'https://www.googleapis.com/batch/gmail/v1';
const MAX_BATCH_SIZE = 100; // Gmail caps a single batch at 100 sub-requests.

function _genBoundary() {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function _buildSubRequest({ messageId, format, metadataHeaders }) {
  const params = new URLSearchParams();
  if (format) params.set('format', format);
  if (Array.isArray(metadataHeaders)) {
    for (const h of metadataHeaders) params.append('metadataHeaders', h);
  }
  const qs = params.toString();
  const url = `/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}${qs ? `?${qs}` : ''}`;
  return `GET ${url} HTTP/1.1\r\n\r\n`;
}

function _buildMultipartBody(messageIds, opts, boundary) {
  const parts = [];
  for (let i = 0; i < messageIds.length; i++) {
    const id = messageIds[i];
    parts.push(
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-ID: <item-${i}>\r\n` +
      `\r\n` +
      _buildSubRequest({ messageId: id, ...opts }) +
      `\r\n`
    );
  }
  parts.push(`--${boundary}--\r\n`);
  return parts.join('');
}

// Parse a multipart/mixed response body. Returns an array parallel to the
// input ids, with each element being the JSON-parsed body of that sub-
// response (or null on individual failure).
function _parseMultipart(body, boundary, count) {
  const out = new Array(count).fill(null);
  // Sections are delimited by `--<boundary>`. Final delimiter is
  // `--<boundary>--`. Split by the boundary marker; ignore the preamble
  // (before first boundary) and epilogue (after closing boundary).
  const sections = body.split(`--${boundary}`);
  // sections[0] is the preamble (often empty); skip it.
  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i];
    if (!sec || sec.startsWith('--')) continue; // closing boundary marker
    // Find the inner HTTP body. Structure within a section:
    //   <outer headers (Content-Type, Content-ID)>
    //   \r\n\r\n
    //   <inner HTTP status line + headers>
    //   \r\n\r\n
    //   <inner JSON body>
    const firstSplit = sec.indexOf('\r\n\r\n');
    if (firstSplit === -1) continue;
    const innerStart = sec.indexOf('\r\n\r\n', firstSplit + 4);
    if (innerStart === -1) continue;
    const outerHeaders = sec.slice(0, firstSplit);
    const innerBody = sec.slice(innerStart + 4).replace(/\r\n$/, '');

    // Recover the original index from the Content-ID we set
    // (`<response-item-N>` typically). Fall back to sequential ordering.
    const idMatch = outerHeaders.match(/Content-ID:\s*<response-item-(\d+)>/i);
    const originalIdx = idMatch ? Number(idMatch[1]) : (i - 1);

    // Inner HTTP status line — first line of innerBody-prefix portion.
    // We need to strip any inner headers before the JSON body.
    // sec.slice(firstSplit+4, innerStart) is the inner HTTP block (status
    // + headers); we don't strictly need the status here, but if it's
    // not 2xx we should record null.
    const innerHttpBlock = sec.slice(firstSplit + 4, innerStart);
    const statusLine = innerHttpBlock.split('\r\n', 1)[0] || '';
    const statusMatch = statusLine.match(/HTTP\/[\d.]+\s+(\d+)/);
    const status = statusMatch ? Number(statusMatch[1]) : 0;
    if (status < 200 || status >= 300) {
      // Log so we can monitor partial-batch failures. Without this the
      // user silently sees 49/50 emails and we have no signal that
      // Gmail is rate-limiting or rejecting individual messages.
      console.warn('[gmailBatch] sub-request status', status, 'for index', originalIdx);
      if (originalIdx >= 0 && originalIdx < count) out[originalIdx] = null;
      continue;
    }

    try {
      const parsed = JSON.parse(innerBody);
      if (originalIdx >= 0 && originalIdx < count) out[originalIdx] = parsed;
    } catch {
      if (originalIdx >= 0 && originalIdx < count) out[originalIdx] = null;
    }
  }
  return out;
}

// Sends one batch request. Splits into chunks of MAX_BATCH_SIZE if needed
// and runs the chunks in parallel. The `client` arg is an OAuth2 client
// from googleapis (we pull a fresh access token via client.getAccessToken).
export async function batchGetMessages(client, messageIds, opts = {}) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) return [];
  if (messageIds.length > MAX_BATCH_SIZE) {
    const chunks = [];
    for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
      chunks.push(messageIds.slice(i, i + MAX_BATCH_SIZE));
    }
    const results = await Promise.all(chunks.map(c => batchGetMessages(client, c, opts)));
    return results.flat();
  }

  const tokenInfo = await client.getAccessToken();
  const accessToken = tokenInfo?.token;
  if (!accessToken) throw new Error('batchGetMessages: no access token');

  const boundary = _genBoundary();
  const body = _buildMultipartBody(messageIds, opts, boundary);

  // Use Node's https rather than fetch() so we can stream the request body
  // and read the response Content-Type to pull the response boundary.
  const responseText = await new Promise((resolve, reject) => {
    const url = new URL(BATCH_URL);
    const req = https.request({
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/mixed; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const ct = res.headers['content-type'] || '';
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Gmail batch HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
        }
        const m = ct.match(/boundary=([^;]+)/i);
        if (!m) return reject(new Error('Gmail batch response missing boundary'));
        resolve({ text, boundary: m[1].replace(/^"|"$/g, '') });
      });
    });
    req.on('error', reject);
    // Hard timeout so a hung Gmail backend doesn't stall the user's
    // inbox load forever. 20s is generous for a 100-msg batch — typical
    // is 200-400ms. Render's load balancer would eventually kill the
    // upstream request but during that window the user sees nothing.
    req.setTimeout(20000, () => {
      req.destroy(new Error('Gmail batch HTTP timeout (20s)'));
    });
    req.write(body);
    req.end();
  });

  return _parseMultipart(responseText.text, responseText.boundary, messageIds.length);
}
