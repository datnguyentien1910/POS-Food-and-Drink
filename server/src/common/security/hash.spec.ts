import { describe, expect, it } from 'vitest';
import { hashSecret, sha256Hex, verifySecret } from './hash.js';

describe('hashSecret', () => {
  it('verifies the original secret', async () => {
    const hash = await hashSecret('Owner@12345');

    await expect(verifySecret(hash, 'Owner@12345')).resolves.toBe(true);
    await expect(verifySecret(hash, 'wrong')).resolves.toBe(false);
  });

  it('uses a unique salt for every hash', async () => {
    const first = await hashSecret('same-secret');
    const second = await hashSecret('same-secret');

    expect(first).not.toBe(second);
  });

  it('verifies a PIN only with the same pepper', async () => {
    const hash = await hashSecret('1234', 'pepper-one');

    await expect(verifySecret(hash, '1234', 'pepper-one')).resolves.toBe(
      true,
    );
    await expect(verifySecret(hash, '1234', 'pepper-two')).resolves.toBe(
      false,
    );
  });
});

describe('sha256Hex', () => {
  it('returns a stable 64-character hex digest', () => {
    const digest = sha256Hex('abc');

    expect(digest).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(digest).toHaveLength(64);
  });
});
