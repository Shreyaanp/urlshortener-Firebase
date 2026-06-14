const assert = require('node:assert/strict');
const test = require('node:test');
const {
  escapeHtml,
  generateShortCode,
  isValidShortCode,
  normalizeLongUrl,
  normalizePrivateKey,
  parseServiceAccount,
} = require('../index');

test('normalizeLongUrl accepts http and https absolute URLs', () => {
  assert.equal(normalizeLongUrl(' https://example.com/path?q=1 '), 'https://example.com/path?q=1');
  assert.equal(normalizeLongUrl('http://example.com'), 'http://example.com/');
});

test('normalizeLongUrl rejects unsafe or invalid URLs', () => {
  assert.throws(() => normalizeLongUrl(''), /Enter a URL first/);
  assert.throws(() => normalizeLongUrl('/relative'), /valid absolute URL/);
  assert.throws(() => normalizeLongUrl('javascript:alert(1)'), /Only http and https/);
});

test('generateShortCode returns valid short codes', () => {
  const shortCode = generateShortCode(12);

  assert.equal(shortCode.length, 12);
  assert.equal(isValidShortCode(shortCode), true);
});

test('escapeHtml escapes markup and attributes', () => {
  assert.equal(
    escapeHtml('<script data-x="1">alert(\'x\')</script>'),
    '&lt;script data-x=&quot;1&quot;&gt;alert(&#39;x&#39;)&lt;/script&gt;',
  );
});

test('parseServiceAccount normalizes escaped private key newlines', () => {
  const serviceAccount = parseServiceAccount(JSON.stringify({
    project_id: 'demo',
    client_email: 'demo@example.com',
    private_key: 'line-one\\nline-two',
  }));

  assert.equal(serviceAccount.private_key, 'line-one\nline-two');
});

test('normalizePrivateKey keeps empty values empty', () => {
  assert.equal(normalizePrivateKey(''), '');
  assert.equal(normalizePrivateKey(undefined), undefined);
});
