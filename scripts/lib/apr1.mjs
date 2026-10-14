// Apache APR1-MD5 password hash for .htpasswd (same output as `openssl passwd -apr1`)
import crypto from 'node:crypto';

const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const md5 = (...parts) => {
  const hash = crypto.createHash('md5');
  parts.forEach((part) => hash.update(part));
  return hash.digest();
};

const to64 = (value, length) => {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ITOA64[value & 0x3f];
    value >>= 6;
  }
  return out;
};

export function randomSalt() {
  return Array.from(crypto.randomBytes(8), (byte) => ITOA64[byte & 0x3f]).join('');
}

export function apr1(password, salt = randomSalt()) {
  const pw = Buffer.from(password, 'utf8');
  const sl = Buffer.from(salt.slice(0, 8), 'utf8');
  const magic = Buffer.from('$apr1$');

  let alt = md5(pw, sl, pw);
  const ctx = [pw, magic, sl];
  for (let len = pw.length; len > 0; len -= 16) ctx.push(alt.subarray(0, Math.min(16, len)));
  for (let i = pw.length; i; i >>= 1) ctx.push(i & 1 ? Buffer.from([0]) : pw.subarray(0, 1));
  let final = md5(...ctx);

  for (let i = 0; i < 1000; i++) {
    const parts = [];
    parts.push(i & 1 ? pw : final);
    if (i % 3) parts.push(sl);
    if (i % 7) parts.push(pw);
    parts.push(i & 1 ? final : pw);
    final = md5(...parts);
  }

  const f = final;
  const encoded =
    to64((f[0] << 16) | (f[6] << 8) | f[12], 4) +
    to64((f[1] << 16) | (f[7] << 8) | f[13], 4) +
    to64((f[2] << 16) | (f[8] << 8) | f[14], 4) +
    to64((f[3] << 16) | (f[9] << 8) | f[15], 4) +
    to64((f[4] << 16) | (f[10] << 8) | f[5], 4) +
    to64(f[11], 2);
  return `$apr1$${sl.toString()}$${encoded}`;
}
