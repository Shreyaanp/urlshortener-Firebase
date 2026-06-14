const crypto = require('crypto');
const fs = require('fs/promises');
const http = require('http');
const path = require('path');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
require('dotenv').config({ quiet: true });

const PORT = Number(process.env.PORT || 3000);
const COLLECTION_NAME = process.env.FIRESTORE_COLLECTION || 'urls';
const SHORT_CODE_LENGTH = Number(process.env.SHORT_CODE_LENGTH || 6);
const MAX_URL_LENGTH = 2048;
const MAX_BODY_SIZE = 10 * 1024;
const SHORT_CODE_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;
const SHORT_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const ASSETS = {
  '/light.png': { file: path.join(__dirname, 'light.png'), type: 'image/png' },
  '/dark.png': { file: path.join(__dirname, 'dark.png'), type: 'image/png' },
};

let firestoreClient;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function normalizePrivateKey(value) {
  return value ? value.replace(/\\n/g, '\n') : value;
}

function parseServiceAccount(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    const serviceAccount = JSON.parse(rawValue);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = normalizePrivateKey(serviceAccount.private_key);
    }
    return serviceAccount;
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must be valid JSON.');
  }
}

function buildFirestoreOptions(env = process.env) {
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  const projectId =
    env.FIREBASE_PROJECT_ID ||
    env.GOOGLE_CLOUD_PROJECT ||
    env.GCLOUD_PROJECT ||
    serviceAccount?.project_id;

  if (serviceAccount) {
    return {
      projectId,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
    };
  }

  const clientEmail = env.FIREBASE_CLIENT_EMAIL || env.CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY || env.PRIVATE_KEY;

  if (clientEmail && privateKey) {
    return {
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: normalizePrivateKey(privateKey),
      },
    };
  }

  if (clientEmail || privateKey) {
    throw new Error('Both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required.');
  }

  return projectId ? { projectId } : {};
}

function getFirestore() {
  if (!firestoreClient) {
    firestoreClient = new Firestore(buildFirestoreOptions());
  }

  return firestoreClient;
}

function setFirestoreClientForTests(client) {
  firestoreClient = client;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeLongUrl(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    throw new HttpError(400, 'Enter a URL first.');
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new HttpError(400, `URLs must be ${MAX_URL_LENGTH} characters or less.`);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    throw new HttpError(400, 'Enter a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new HttpError(400, 'Only http and https URLs are allowed.');
  }

  return parsed.toString();
}

function isValidShortCode(shortCode) {
  return SHORT_CODE_PATTERN.test(String(shortCode || ''));
}

function generateShortCode(length = SHORT_CODE_LENGTH) {
  let code = '';

  for (let index = 0; index < length; index += 1) {
    code += SHORT_CODE_CHARS[crypto.randomInt(SHORT_CODE_CHARS.length)];
  }

  return code;
}

async function findUrlByShortCode(collection, shortCode) {
  const docSnapshot = await collection.doc(shortCode).get();
  if (docSnapshot.exists) {
    return docSnapshot.data();
  }

  const querySnapshot = await collection.where('short', '==', shortCode).limit(1).get();
  return querySnapshot.empty ? null : querySnapshot.docs[0].data();
}

async function generateUniqueShortCode(collection, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const shortCode = generateShortCode();
    const existing = await findUrlByShortCode(collection, shortCode);

    if (!existing) {
      return shortCode;
    }
  }

  throw new Error('Could not generate a unique short code.');
}

async function shortenUrl(longUrl, db = getFirestore()) {
  const normalizedUrl = normalizeLongUrl(longUrl);
  const collection = db.collection(COLLECTION_NAME);
  const existing = await collection.where('longURL', '==', normalizedUrl).limit(1).get();

  if (!existing.empty) {
    const shortCode = existing.docs[0].data().short;
    if (isValidShortCode(shortCode)) {
      return shortCode;
    }
  }

  const shortCode = await generateUniqueShortCode(collection);

  await collection.doc(shortCode).set({
    longURL: normalizedUrl,
    short: shortCode,
    createdAt: FieldValue.serverTimestamp(),
  });

  return shortCode;
}

async function getLongUrl(shortCode, db = getFirestore()) {
  if (!isValidShortCode(shortCode)) {
    return null;
  }

  const collection = db.collection(COLLECTION_NAME);
  const record = await findUrlByShortCode(collection, shortCode);

  if (!record?.longURL) {
    return null;
  }

  try {
    return normalizeLongUrl(record.longURL);
  } catch (error) {
    return null;
  }
}

function getHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getBaseUrl(req) {
  const forwardedProtocol = getHeaderValue(req.headers['x-forwarded-proto']);
  const forwardedHost = getHeaderValue(req.headers['x-forwarded-host']);
  const host = forwardedHost || getHeaderValue(req.headers.host) || `localhost:${PORT}`;
  const protocol = forwardedProtocol || (req.socket?.encrypted ? 'https' : 'http');

  return `${String(protocol).split(',')[0]}://${String(host).split(',')[0]}`.replace(/\/$/, '');
}

function renderPage({ error, shortUrl } = {}) {
  const escapedError = error ? escapeHtml(error) : '';
  const escapedShortUrl = shortUrl ? escapeHtml(shortUrl) : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Firebase URL Shortener</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #eef1f6;
      --text: #172033;
      --panel: #ffffff;
      --muted: #5b6476;
      --accent: #0f766e;
      --accent-strong: #0a5f59;
      --danger: #b42318;
      --border: #d6dbe6;
      --shadow: 0 24px 70px rgba(23, 32, 51, 0.14);
    }

    [data-theme="dark"] {
      --bg: #101722;
      --text: #f7f9fc;
      --panel: #182233;
      --muted: #b5bfce;
      --accent: #2dd4bf;
      --accent-strong: #5eead4;
      --danger: #ffb4ab;
      --border: #2b384d;
      --shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(45, 212, 191, 0.16), transparent 32rem),
        var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    main {
      width: min(100%, 680px);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: clamp(24px, 6vw, 48px);
    }

    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 32px;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 6vw, 3.75rem);
      line-height: 0.95;
      letter-spacing: 0;
    }

    .theme-toggle {
      width: 44px;
      height: 44px;
      display: inline-grid;
      place-items: center;
      flex: 0 0 auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
    }

    .theme-toggle img {
      width: 28px;
      height: 28px;
    }

    form {
      display: grid;
      gap: 14px;
    }

    label {
      color: var(--muted);
      font-weight: 700;
    }

    .input-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
    }

    input {
      min-width: 0;
      width: 100%;
      min-height: 52px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0 16px;
      color: var(--text);
      background: transparent;
      font: inherit;
    }

    input:focus {
      outline: 3px solid rgba(45, 212, 191, 0.28);
      border-color: var(--accent);
    }

    button[type="submit"] {
      min-height: 52px;
      border: 0;
      border-radius: 8px;
      padding: 0 22px;
      background: var(--accent);
      color: #071512;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    button[type="submit"]:hover {
      background: var(--accent-strong);
    }

    .message {
      margin-top: 24px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-wrap: anywhere;
    }

    .message a {
      color: var(--accent-strong);
      font-weight: 800;
    }

    .error {
      color: var(--danger);
      font-weight: 700;
    }

    @media (max-width: 560px) {
      body {
        padding: 14px;
      }

      .input-row {
        grid-template-columns: 1fr;
      }

      button[type="submit"] {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Shorten a link</h1>
      <button class="theme-toggle" type="button" aria-label="Toggle theme" title="Toggle theme">
        <img id="theme-icon" src="/light.png" alt="">
      </button>
    </header>
    <form method="post" action="/submit">
      <label for="longurl">Long URL</label>
      <div class="input-row">
        <input id="longurl" name="longurl" type="url" inputmode="url" placeholder="https://example.com/very/long/link" required>
        <button type="submit">Shorten</button>
      </div>
    </form>
    ${escapedError ? `<div class="message error" role="alert">${escapedError}</div>` : ''}
    ${escapedShortUrl ? `<div class="message">Short URL: <a href="${escapedShortUrl}" target="_blank" rel="noopener noreferrer">${escapedShortUrl}</a></div>` : ''}
  </main>
  <script>
    const root = document.documentElement;
    const button = document.querySelector('.theme-toggle');
    const icon = document.getElementById('theme-icon');
    const savedTheme = localStorage.getItem('theme') || 'light';

    function setTheme(theme) {
      root.dataset.theme = theme;
      icon.src = theme === 'dark' ? '/dark.png' : '/light.png';
      localStorage.setItem('theme', theme);
    }

    setTheme(savedTheme);
    button.addEventListener('click', () => {
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  </script>
</body>
</html>`;
}

function sendHtml(req, res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : html);
}

function sendRedirect(res, location) {
  res.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end();
}

async function sendAsset(req, pathname, res) {
  const asset = ASSETS[pathname];
  if (!asset) {
    return false;
  }

  const data = await fs.readFile(asset.file);
  res.writeHead(200, {
    'Content-Type': asset.type,
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : data);
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();

      if (body.length > MAX_BODY_SIZE) {
        reject(new HttpError(413, 'Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getPathname(req) {
  const url = new URL(req.url, getBaseUrl(req));
  return url.pathname;
}

async function handler(req, res) {
  try {
    const pathname = getPathname(req);
    const isGetLike = req.method === 'GET' || req.method === 'HEAD';

    if (isGetLike && (await sendAsset(req, pathname, res))) {
      return;
    }

    if (isGetLike && pathname === '/') {
      sendHtml(req, res, 200, renderPage());
      return;
    }

    if (req.method === 'POST' && pathname === '/submit') {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const shortCode = await shortenUrl(params.get('longurl'));
      const shortUrl = `${getBaseUrl(req)}/${shortCode}`;
      sendHtml(req, res, 201, renderPage({ shortUrl }));
      return;
    }

    if (isGetLike && pathname.length > 1) {
      const shortCode = decodeURIComponent(pathname.slice(1));
      const longUrl = await getLongUrl(shortCode);

      if (longUrl) {
        sendRedirect(res, longUrl);
        return;
      }

      sendHtml(req, res, 404, renderPage({ error: 'Short URL not found.' }));
      return;
    }

    sendHtml(req, res, 405, renderPage({ error: 'Method not allowed.' }));
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode >= 500 ? 'Something went wrong.' : error.message;

    if (statusCode >= 500) {
      console.error(error);
    }

    sendHtml(req, res, statusCode, renderPage({ error: message }));
  }
}

function createServer() {
  return http.createServer(handler);
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
  });
}

module.exports = Object.assign(handler, {
  buildFirestoreOptions,
  createServer,
  escapeHtml,
  generateShortCode,
  getBaseUrl,
  getLongUrl,
  isValidShortCode,
  normalizeLongUrl,
  normalizePrivateKey,
  parseServiceAccount,
  renderPage,
  setFirestoreClientForTests,
  shortenUrl,
});
