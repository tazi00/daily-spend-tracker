/**
 * Auth service — deliberately small for the MVP.
 *
 * Product rule: every financial record belongs to a user, and a user's data
 * must be reachable from any device. For now that means a single starter user
 * plus a signed token the browser stores in localStorage and sends on every
 * request. Phase 5 replaces this with real sign-up/sign-in; the ownership
 * checks everywhere else already treat userId as untrusted input, so that
 * swap won't require touching repositories or the frontend API shape.
 */
import crypto from "node:crypto";
import * as usersRepo from "../repositories/users.js";
import { config } from "../utils/config.js";
import { ServiceError } from "../utils/validation.js";

/** Resolve the current user. MVP: the single starter user, always. */
export function currentUser() {
  const user = usersRepo.findByEmail(config.starterUserEmail);
  if (!user) throw new ServiceError("UNAUTHENTICATED", "No user found");
  return user;
}

/**
 * Sign a lightweight token for the starter user. Format:
 *   base64url(payload).base64url(hmac)
 * Payload carries the user id + expiry; the HMAC proves it wasn't forged.
 * (Same trust model as JWT, 15 lines instead of a dependency.)
 */
export function issueToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", config.authSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

/** Verify a token and return the userId it names, or null. */
export function verifyToken(token) {
  if (typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto
    .createHmac("sha256", config.authSecret)
    .update(payload)
    .digest("base64url");
  // timingSafeEqual needs equal lengths; pad to avoid leaking length info.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.uid !== "number" || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

/**
 * Express middleware: attach userId from the Authorization header.
 * MVP behavior: accept a valid token; otherwise fall back to the starter
 * user so the app is usable before any sign-in flow exists.
 */
export function requireUser(req, _res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const uid = verifyToken(token);
  if (uid) {
    req.userId = uid;
  } else {
    // Pre-auth fallback: everything belongs to the starter user.
    req.userId = currentUser().id;
  }
  next();
}
