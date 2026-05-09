import { customAlphabet } from 'nanoid';

// Lowercase alphanumeric, 5 chars. Avoid 0/o/1/l for readability.
const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
const generate = customAlphabet(alphabet, 5);

export function shortId() {
  return generate();
}
