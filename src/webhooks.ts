import { createVerify } from "node:crypto";

import { normalizePublicKey } from "./signing.js";

import type { VerifyWebhookOptions, WebhookEvent, WebhookPublicKeys } from "./types.js";

/** Default tolerance: 5 minutes */
const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

/** Waffo Pancake test environment webhook verification public key. */
const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxnmRY6yMMA3lVqmAU6ZG
b1sjL/+r/z6E+ZjkXaDAKiqOhk9rpazni0bNsGXwmftTPk9jy2wn+j6JHODD/WH/
SCnSfvKkLIjy4Hk7BuCgB174C0ydan7J+KgXLkOwgCAxxB68t2tezldwo74ZpXgn
F49opzMvQ9prEwIAWOE+kV9iK6gx/AckSMtHIHpUesoPDkldpmFHlB2qpf1vsFTZ
5kD6DmGl+2GIVK01aChy2lk8pLv0yUMu18v44sLkO5M44TkGPJD9qG09wrvVG2wp
OTVCn1n5pP8P+HRLcgzbUB3OlZVfdFurn6EZwtyL4ZD9kdkQ4EZE/9inKcp3c1h4
xwIDAQAB
-----END PUBLIC KEY-----`;

/** Waffo Pancake production environment webhook verification public key. */
const PROD_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz+xApdTIb4ua+DgZKQ54
iBsD82ybyhGCLRETONW4Jgbb3A8DUM1LqBk6r/CmTOCHqLalTQHNigvP3R5zkDNX
iRJz6gA4MJ/+8K0+mnEE2RISQzN+Qu65TNd6svb+INm/kMaftY4uIXr6y6kchtTJ
dwnQhcKdAL2v7h7IFnkVelQsKxDdb2PqX8xX/qwd01iXvMcpCCaXovUwZsxH2QN5
ZKBTseJivbhUeyJCco4fdUyxOMHe2ybCVhyvim2uxAl1nkvL5L8RCWMCAV55LLo0
9OhmLahz/DYNu13YLVP6dvIT09ZFBYU6Owj1NxdinTynlJCFS9VYwBgmftosSE1U
dwIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Parse `X-Waffo-Signature` header.
 *
 * Format: `t=<timestamp>,v1=<base64signature>`
 *
 * @returns Parsed `t` (timestamp string) and `v1` (base64 signature)
 */
function parseSignatureHeader(header: string): { t: string; v1: string } {
  let t = "";
  let v1 = "";
  for (const pair of header.split(",")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (key === "t") t = value;
    else if (key === "v1") v1 = value;
  }
  return { t, v1 };
}

/**
 * Verify RSA-SHA256 signature against a public key.
 *
 * @param signatureInput - The string to verify (`${t}.${rawBody}`)
 * @param v1 - Base64-encoded signature
 * @param publicKey - PEM public key
 * @returns Whether the signature is valid
 */
function rsaVerify(signatureInput: string, v1: string, publicKey: string): boolean {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signatureInput);
  return verifier.verify(publicKey, v1, "base64");
}

/**
 * Resolve the public key for a given environment using the multi-level fallback chain.
 *
 * Resolution order:
 * 1. `configKeys[env]` or `configKeys` (if string) — from WaffoPancakeConfig
 * 2. `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` / `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` — env var per-env
 * 3. `WAFFO_WEBHOOK_PUBLIC_KEY` — env var shared
 * 4. Built-in hardcoded key
 *
 * @param env - Target environment
 * @param configKeys - Config-level public key(s)
 * @returns Resolved and normalized PEM public key
 */
function resolveKeyForEnv(env: "test" | "prod", configKeys?: WebhookPublicKeys): string {
  // 1. Config-level key
  if (typeof configKeys === "string") {
    return normalizePublicKey(configKeys);
  }
  if (configKeys?.[env]) {
    return normalizePublicKey(configKeys[env]);
  }

  // 2. Environment variable (per-env)
  const envSpecific = env === "test" ? process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY : process.env.WAFFO_WEBHOOK_PROD_PUBLIC_KEY;
  if (envSpecific) {
    return normalizePublicKey(envSpecific);
  }

  // 3. Environment variable (shared)
  const generic = process.env.WAFFO_WEBHOOK_PUBLIC_KEY;
  if (generic) {
    return normalizePublicKey(generic);
  }

  // 4. Built-in hardcoded key
  return env === "test" ? TEST_PUBLIC_KEY : PROD_PUBLIC_KEY;
}

/**
 * Verify and parse an incoming Waffo Pancake webhook event.
 *
 * Public key resolution (per environment):
 * 1. `options.publicKey` — per-call override (highest priority, skips all other resolution)
 * 2. `options.publicKeys[env]` or `options.publicKeys` (string) — config-level
 * 3. `WAFFO_WEBHOOK_{TEST|PROD}_PUBLIC_KEY` environment variable
 * 4. `WAFFO_WEBHOOK_PUBLIC_KEY` environment variable
 * 5. Built-in hardcoded key
 *
 * Behavior:
 * - Parses the `X-Waffo-Signature` header (`t=<timestamp>,v1=<base64sig>`)
 * - Builds signature input `${t}.${rawBody}` and verifies with RSA-SHA256
 * - When `environment` is not specified, tries prod key first, then test key
 * - Optional: checks timestamp to prevent replay attacks (default 5-minute tolerance)
 *
 * @param payload - Raw request body string (must be unparsed)
 * @param signatureHeader - Value of the `X-Waffo-Signature` header
 * @param options - Verification options
 * @returns Parsed webhook event
 * @throws Error if header is missing/malformed, signature is invalid, or timestamp is stale
 *
 * @example
 * // Express (use raw body!)
 * app.post("/webhooks", express.raw({ type: "application/json" }), (req, res) => {
 *   try {
 *     const event = verifyWebhook(
 *       req.body.toString("utf-8"),
 *       req.headers["x-waffo-signature"] as string,
 *     );
 *     res.status(200).send("OK");
 *     handleEventAsync(event).catch(console.error);
 *   } catch {
 *     res.status(401).send("Invalid signature");
 *   }
 * });
 *
 * @example
 * // Next.js App Router
 * export async function POST(request: Request) {
 *   const body = await request.text();
 *   const sig = request.headers.get("x-waffo-signature");
 *   const event = verifyWebhook(body, sig);
 *   // handle event ...
 *   return new Response("OK");
 * }
 *
 * @example
 * // Specify environment explicitly
 * const event = verifyWebhook(body, sig, { environment: "prod" });
 *
 * @example
 * // Disable replay protection
 * const event = verifyWebhook(body, sig, { toleranceMs: 0 });
 */
export function verifyWebhook<T = Record<string, unknown>>(
  payload: string,
  signatureHeader: string | undefined | null,
  options?: VerifyWebhookOptions,
): WebhookEvent<T> {
  if (!signatureHeader) {
    throw new Error("Missing X-Waffo-Signature header");
  }

  const { t, v1 } = parseSignatureHeader(signatureHeader);
  if (!t || !v1) {
    throw new Error("Malformed X-Waffo-Signature header: missing t or v1");
  }

  // Replay protection
  const toleranceMs = options?.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  if (toleranceMs > 0) {
    const timestampMs = Number(t);
    if (Number.isNaN(timestampMs)) {
      throw new Error("Invalid timestamp in X-Waffo-Signature header");
    }
    if (Math.abs(Date.now() - timestampMs) > toleranceMs) {
      throw new Error("Webhook timestamp outside tolerance window (possible replay attack)");
    }
  }

  // RSA-SHA256 verification
  const signatureInput = `${t}.${payload}`;
  const directKey = options?.publicKey;

  if (directKey) {
    // Per-call override — highest priority, skip all resolution
    const normalizedKey = normalizePublicKey(directKey);
    if (!rsaVerify(signatureInput, v1, normalizedKey)) {
      throw new Error("Invalid webhook signature (custom key)");
    }
  } else {
    const configKeys = options?.publicKeys;
    const env = options?.environment;

    if (env === "test" || env === "prod") {
      const key = resolveKeyForEnv(env, configKeys);
      if (!rsaVerify(signatureInput, v1, key)) {
        throw new Error(`Invalid webhook signature (${env} key)`);
      }
    } else {
      // Auto-detect: try prod first, then test
      const prodKey = resolveKeyForEnv("prod", configKeys);
      if (!rsaVerify(signatureInput, v1, prodKey)) {
        const testKey = resolveKeyForEnv("test", configKeys);
        if (!rsaVerify(signatureInput, v1, testKey)) {
          throw new Error("Invalid webhook signature (tried both prod and test keys)");
        }
      }
    }
  }

  return JSON.parse(payload) as WebhookEvent<T>;
}
