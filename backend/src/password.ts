import crypto from 'node:crypto';

// scrypt (built into Node, no native dependency), salted per-password,
// verified with a timing-safe comparison so a failed check can't be
// used to guess the hash byte-by-byte via timing. Shared by staff auth
// and self-registered customer accounts — one implementation, not two.

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const actual = Buffer.from(hash, 'hex');
  if (candidate.length !== actual.length) return false;
  return crypto.timingSafeEqual(candidate, actual);
}
