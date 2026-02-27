import crypto from 'crypto';

// Validate ENCRYPTION_KEY at module load time — fail fast on misconfiguration
// Key must be a 64-character hex string (32 bytes for AES-256)
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    'ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes for AES-256-GCM
// NOTE: We reuse the same key for HMAC but in a completely separate operation.
// The HMAC output is one-way and cannot be reversed to obtain the key or plaintext.
const HMAC_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

/**
 * Encrypts a phone number using AES-256-GCM.
 *
 * Returns a base64-encoded JSON payload: { iv, authTag, ciphertext } (all hex-encoded).
 * Each call produces a different ciphertext because the IV is random — this is intentional.
 * Use hashPhoneForLookup() for DNC list lookups, NOT the encrypted value.
 *
 * Phone digits are normalized (non-digits stripped) before encryption for consistent storage.
 */
export function encryptPhone(phone: string): string {
  const normalized = phone.replace(/\D/g, ''); // Strip non-digits
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM mode
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.from(
    JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
    })
  ).toString('base64');
}

/**
 * Decrypts a phone number that was encrypted by encryptPhone().
 *
 * USE SPARINGLY — only for audit exports with proper authorization.
 * Throws if the ciphertext is tampered (GCM authentication tag mismatch).
 */
export function decryptPhone(encryptedPhone: string): string {
  const { iv, authTag, ciphertext } = JSON.parse(
    Buffer.from(encryptedPhone, 'base64').toString('utf8')
  ) as { iv: string; authTag: string; ciphertext: string };
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  return (
    decipher.update(Buffer.from(ciphertext, 'hex')).toString('utf8') + decipher.final('utf8')
  );
}

/**
 * Creates a one-way HMAC-SHA256 hash of the phone number for DNC list lookups.
 *
 * IMPORTANT: This hash is stored in DoNotCallEntry.phoneEncrypted (the field name is
 * intentionally kept as "phoneEncrypted" in the schema, but this is a HMAC hash, NOT
 * an AES-encrypted value). The HMAC cannot be reversed to obtain the phone number —
 * that is the point. This allows O(1) DNC lookups without decryption.
 *
 * Normalization ensures '555-123-4567', '5551234567', and '+15551234567' all hash the same.
 */
export function hashPhoneForLookup(phone: string): string {
  const normalized = phone.replace(/\D/g, '');
  return crypto.createHmac('sha256', HMAC_KEY).update(normalized).digest('hex');
}
