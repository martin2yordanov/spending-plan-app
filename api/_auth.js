import { verifyToken } from "@clerk/backend";

// Only Clerk-owned plans can be authenticated at all — a sync code (used
// before sign-in) has no session behind it, that IS its access model. So
// this only ever needs to answer "is this really user_XXXX", never
// "is this really sync code ABC123".
const CLERK_USER_ID = /^user_[A-Za-z0-9]+$/;

export function isClerkUserId(id) {
  return CLERK_USER_ID.test(id);
}

// Whether the deployment can verify a session at all. False until
// CLERK_SECRET_KEY is added in Vercel — see the call site in data.js for why
// that case does not fail closed.
export function authConfigured() {
  return !!process.env.CLERK_SECRET_KEY;
}

/**
 * Verifies the bearer token against Clerk and returns the authenticated
 * user id, or null if there is no valid session. Never throws — every
 * failure (missing header, expired token, wrong signature, missing
 * CLERK_SECRET_KEY) is treated the same as "not authenticated" by the caller.
 */
export async function getVerifiedUserId(req) {
  const header = req.headers?.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !authConfigured()) return null;
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
