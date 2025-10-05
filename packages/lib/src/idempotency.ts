import { customAlphabet } from 'nanoid/non-secure';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(ALPHABET, 24);

export function createIdempotencyKey(prefix = 'local-office'): string {
  return `${prefix}_${nanoid()}`;
}
