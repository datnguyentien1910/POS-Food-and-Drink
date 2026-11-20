import { createHash } from 'node:crypto';
import { argon2id, hash as argonHash, verify as argonVerify } from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashSecret(
  secret: string,
  pepper?: string,
): Promise<string> {
  return argonHash(pepper ? `${secret}${pepper}` : secret, ARGON2_OPTIONS);
}

export async function verifySecret(
  hash: string,
  secret: string,
  pepper?: string,
): Promise<boolean> {
  try {
    return await argonVerify(
      hash,
      pepper ? `${secret}${pepper}` : secret,
    );
  } catch {
    return false;
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
