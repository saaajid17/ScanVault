const assert = require('assert');
const {
  detectPayloadType,
  parseWifiString,
  parseContact,
  parseTel,
  parseEmail,
  parseSms,
  parseScanPayload,
} = require('./scan-parser.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

console.log('detectPayloadType');
test('plain https URL', () => {
  assert.strictEqual(detectPayloadType('https://www.yum.my/menu'), 'url');
});
test('plain http URL', () => {
  assert.strictEqual(detectPayloadType('http://example.com'), 'url');
});
test('WIFI string', () => {
  assert.strictEqual(detectPayloadType('WIFI:T:WPA;S:HappyBeans_WiFi;P:SmileAndSip2024;;'), 'wifi');
});
test('BEGIN:VCARD', () => {
  assert.strictEqual(detectPayloadType('BEGIN:VCARD\nVERSION:3.0\nFN:Alex Everheart\nEND:VCARD'), 'contact');
});
test('MECARD', () => {
  assert.strictEqual(detectPayloadType('MECARD:N:Everheart,Alex;TEL:+15551877757;;'), 'contact');
});
test('tel: URI', () => {
  assert.strictEqual(detectPayloadType('tel:+15551877757'), 'tel');
});
test('mailto: URI', () => {
  assert.strictEqual(detectPayloadType('mailto:alex@alexeverheart.com'), 'email');
});
test('sms: URI', () => {
  assert.strictEqual(detectPayloadType('sms:+15551877757'), 'sms');
});
test('smsto: URI', () => {
  assert.strictEqual(detectPayloadType('smsto:+15551877757:hello'), 'sms');
});
test('12-digit UPC-A barcode', () => {
  assert.strictEqual(detectPayloadType('036000291452'), 'barcode');
});
test('13-digit EAN-13 barcode', () => {
  assert.strictEqual(detectPayloadType('5449000000996'), 'barcode');
});
test('short numeric string (5 digits) is NOT a barcode', () => {
  assert.strictEqual(detectPayloadType('12345'), 'text');
});
test('plain text', () => {
  assert.strictEqual(detectPayloadType("You're amazing!"), 'text');
});
test('empty string does not crash, falls back to text', () => {
  assert.strictEqual(detectPayloadType(''), 'text');
});
test('null does not crash, falls back to text', () => {
  assert.strictEqual(detectPayloadType(null), 'text');
});
test('undefined does not crash, falls back to text', () => {
  assert.strictEqual(detectPayloadType(undefined), 'text');
});
test('whitespace-padded URL still detected', () => {
  assert.strictEqual(detectPayloadType('   https://example.com  '), 'url');
});

console.log('\nparseWifiString');
test('extracts ssid, password, security', () => {
  const r = parseWifiString('WIFI:T:WPA;S:HappyBeans_WiFi;P:SmileAndSip2024;;');
  assert.strictEqual(r.ssid, 'HappyBeans_WiFi');
  assert.strictEqual(r.password, 'SmileAndSip2024');
  assert.strictEqual(r.security, 'WPA');
});
test('open network with no password', () => {
  const r = parseWifiString('WIFI:T:nopass;S:CafeGuest;P:;;');
  assert.strictEqual(r.ssid, 'CafeGuest');
  assert.strictEqual(r.password, '');
});
test('hidden network flag', () => {
  const r = parseWifiString('WIFI:T:WPA;S:Hidden;P:pass;H:true;;');
  assert.strictEqual(r.hidden, true);
});

console.log('\nparseContact');
test('vCard with FN/TEL/EMAIL', () => {
  const r = parseContact('BEGIN:VCARD\nVERSION:3.0\nFN:Alex Everheart\nTEL:+1-555-187-7757\nEMAIL:alex@alexeverheart.com\nEND:VCARD');
  assert.strictEqual(r.name, 'Alex Everheart');
  assert.strictEqual(r.phone, '+1-555-187-7757');
  assert.strictEqual(r.email, 'alex@alexeverheart.com');
});
test('MECARD with reversed Last,First name', () => {
  const r = parseContact('MECARD:N:Everheart,Alex;TEL:+15551877757;EMAIL:alex@alexeverheart.com;;');
  assert.strictEqual(r.name, 'Alex Everheart');
  assert.strictEqual(r.phone, '+15551877757');
});
test('vCard missing fields degrades gracefully, no crash', () => {
  const r = parseContact('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD');
  assert.strictEqual(r.name, '');
  assert.strictEqual(r.phone, '');
});

console.log('\nparseTel / parseEmail / parseSms');
test('parseTel strips scheme', () => {
  assert.strictEqual(parseTel('tel:+15551877757'), '+15551877757');
});
test('parseEmail splits address and query', () => {
  const r = parseEmail('mailto:alex@alexeverheart.com?subject=Hi');
  assert.strictEqual(r.address, 'alex@alexeverheart.com');
  assert.strictEqual(r.query, 'subject=Hi');
});
test('parseSms splits number and body', () => {
  const r = parseSms('smsto:+15551877757:Running late');
  assert.strictEqual(r.number, '+15551877757');
  assert.strictEqual(r.body, 'Running late');
});
test('parseSms with no body', () => {
  const r = parseSms('sms:+15551877757');
  assert.strictEqual(r.number, '+15551877757');
  assert.strictEqual(r.body, '');
});

console.log('\nparseScanPayload (the single entry point the UI calls)');
test('wraps url type correctly', () => {
  const r = parseScanPayload('https://www.yum.my/menu');
  assert.strictEqual(r.type, 'url');
  assert.strictEqual(r.data, 'https://www.yum.my/menu');
});
test('wraps wifi type with parsed data object', () => {
  const r = parseScanPayload('WIFI:T:WPA;S:Test;P:pass123;;');
  assert.strictEqual(r.type, 'wifi');
  assert.strictEqual(r.data.ssid, 'Test');
});
test('never throws on garbage input', () => {
  assert.doesNotThrow(() => parseScanPayload('\x00\x01 not a real code {{{'));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
