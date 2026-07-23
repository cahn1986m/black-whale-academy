// HMAC-SHA256 session token, signed/verified with the Web Crypto API
// (globalThis.crypto.subtle) rather than Node's `crypto` module.
// middleware.js — the only caller of verifyFreelancerSession — runs
// exclusively on Next.js's Edge Runtime, which has no Node `crypto`
// module (Web Crypto only). Web Crypto is available in both the Edge
// Runtime and the Node.js runtime (API routes), so this one
// implementation works unmodified in both places. Same reasoning
// already documented in middleware.js for the /admin cookie.
const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.FREELANCER_SESSION_SECRET;
  if (!secret) {
    throw new Error('FREELANCER_SESSION_SECRET is not set.');
  }
  return secret;
}

function getKey() {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex) {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

export async function signFreelancerSession(freelancerId, expiresInMs) {
  const payload = JSON.stringify({ freelancerId, exp: Date.now() + expiresInMs });
  const payloadBase64 = btoa(payload);
  const key = await getKey();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  return `${payloadBase64}.${toHex(signatureBuffer)}`;
}

export async function verifyFreelancerSession(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string') return null;

  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payloadBase64 = cookieValue.slice(0, dotIndex);
  const signatureHex = cookieValue.slice(dotIndex + 1);

  const signatureBytes = fromHex(signatureHex);
  if (!signatureBytes) return null;

  const key = await getKey();
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payloadBase64));
  if (!valid) return null;

  let payload;
  try {
    payload = JSON.parse(atob(payloadBase64));
  } catch {
    return null;
  }

  if (!payload || typeof payload.freelancerId !== 'number' || typeof payload.exp !== 'number') {
    return null;
  }

  if (Date.now() >= payload.exp) return null;

  return { freelancerId: payload.freelancerId };
}
