import bcrypt from "bcrypt";
import { randomInt } from "node:crypto";

const COST = 10;
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INITIAL_PASSWORD_LENGTH = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateInitialPassword(
  length: number = INITIAL_PASSWORD_LENGTH,
): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}
