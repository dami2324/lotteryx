/**
 * Utility for hashing and verifying passwords securely using the Web Crypto API.
 * This is native, lightweight, and works seamlessly in both Node.js and Edge/Serverless runtimes.
 */

const ITERATIONS = 100000;
const HASH_LENGTH = 64; // 64 bytes (512 bits)

// Helper to convert array buffer to hex string
function bufToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper to convert hex string back to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const bytes = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(bytes.map(byte => parseInt(byte, 16)));
}

/**
 * Hashes a plaintext password using PBKDF2 with SHA-256 and a random salt.
 * Returns the format: saltHex:hashHex
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Generate a cryptographically secure random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import the password as a raw key
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  
  // Derive the hash bits
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    HASH_LENGTH * 8
  );
  
  const saltHex = bufToHex(salt.buffer);
  const hashHex = bufToHex(derivedBits);
  
  return `${saltHex}:${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored hash string (saltHex:hashHex).
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  
  const [saltHex, originalHashHex] = parts;
  
  const salt = hexToBuf(saltHex);
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    HASH_LENGTH * 8
  );
  
  const currentHashHex = bufToHex(derivedBits);
  
  // Timing safe equality check to prevent timing attacks
  if (currentHashHex.length !== originalHashHex.length) return false;
  let result = 0;
  for (let i = 0; i < currentHashHex.length; i++) {
    result |= currentHashHex.charCodeAt(i) ^ originalHashHex.charCodeAt(i);
  }
  return result === 0;
}
