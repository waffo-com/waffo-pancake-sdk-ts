import { createHash, createPrivateKey, createPublicKey, createSign } from "node:crypto";

const PKCS8_HEADER = "-----BEGIN PRIVATE KEY-----";
const PKCS8_FOOTER = "-----END PRIVATE KEY-----";
const PKCS1_HEADER = "-----BEGIN RSA PRIVATE KEY-----";
const PKCS1_FOOTER = "-----END RSA PRIVATE KEY-----";

const SPKI_HEADER = "-----BEGIN PUBLIC KEY-----";
const SPKI_FOOTER = "-----END PUBLIC KEY-----";
const PKCS1_PUB_HEADER = "-----BEGIN RSA PUBLIC KEY-----";
const PKCS1_PUB_FOOTER = "-----END RSA PUBLIC KEY-----";

/**
 * Normalize a PEM private key string into a valid PEM format.
 *
 * Handles common issues:
 * - Literal `\n` from environment variables (e.g. `PRIVATE_KEY="-----BEGIN...\\n..."`)
 * - Windows-style `\r\n` line endings
 * - Leading/trailing whitespace and blank lines
 * - Missing PEM header/footer (raw base64 input, assumed PKCS#8)
 * - Base64 content on a single line (re-wrapped to 64-char lines)
 * - PKCS#1 (`BEGIN RSA PRIVATE KEY`) accepted as-is
 *
 * @param raw - Private key string in any of the above formats
 * @returns A well-formed PEM string
 * @throws {Error} If the input is empty or contains no base64 content
 *
 * @example
 * // Env var with literal \n
 * normalizePrivateKey("-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----")
 *
 * @example
 * // Raw base64 without PEM wrapper
 * normalizePrivateKey("MIIEvQIBADANBgkqhki...")
 */
export function normalizePrivateKey(raw: string): string {
  if (!raw || !raw.trim()) {
    throw new Error(
      "Private key is empty. Provide an RSA private key in PEM format.",
    );
  }

  // 1. Replace literal \n / \r\n with real newlines
  let pem = raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  // 2. Trim leading/trailing whitespace
  pem = pem.trim();

  // 3. Detect whether PEM headers are present
  const hasPkcs8Header = pem.includes(PKCS8_HEADER);
  const hasPkcs1Header = pem.includes(PKCS1_HEADER);
  const hasHeader = hasPkcs8Header || hasPkcs1Header;

  if (hasHeader) {
    // Strip headers/footers, extract pure base64
    const base64 = pem
      .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
      .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
      .replace(/\s+/g, "");

    if (!base64) {
      throw new Error(
        "Private key contains PEM headers but no key data. Check the key content.",
      );
    }

    // Re-wrap to 64-char lines with the original header type
    const header = hasPkcs1Header ? PKCS1_HEADER : PKCS8_HEADER;
    const footer = hasPkcs1Header ? PKCS1_FOOTER : PKCS8_FOOTER;
    const wrapped = base64.match(/.{1,64}/g)!.join("\n");
    pem = `${header}\n${wrapped}\n${footer}`;
  } else {
    // No PEM header — treat as raw base64, wrap with PKCS#8 headers
    const base64 = pem.replace(/\s+/g, "");

    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
      throw new Error(
        "Private key is not valid PEM or base64. Expected an RSA private key in PEM format or raw base64.",
      );
    }

    const wrapped = base64.match(/.{1,64}/g)!.join("\n");
    pem = `${PKCS8_HEADER}\n${wrapped}\n${PKCS8_FOOTER}`;
  }

  // 4. Validate the key is actually parseable by Node.js crypto
  try {
    createPrivateKey(pem);
  } catch {
    throw new Error(
      "Private key could not be parsed. Ensure it is a valid RSA private key in PKCS#8 or PKCS#1 (PEM) format.",
    );
  }

  return pem;
}

/**
 * Normalize a PEM public key string into a valid PEM format.
 *
 * Handles common issues:
 * - Literal `\n` from environment variables
 * - Windows-style `\r\n` line endings
 * - Leading/trailing whitespace and blank lines
 * - Missing PEM header/footer (raw base64 input, assumed SPKI)
 * - Base64 content on a single line (re-wrapped to 64-char lines)
 * - PKCS#1 (`BEGIN RSA PUBLIC KEY`) accepted as-is
 *
 * @param raw - Public key string in any of the above formats
 * @returns A well-formed PEM string
 * @throws {Error} If the input is empty or contains no base64 content
 *
 * @example
 * // Env var with literal \n
 * normalizePublicKey("-----BEGIN PUBLIC KEY-----\\nMIIB...\\n-----END PUBLIC KEY-----")
 *
 * @example
 * // Raw base64 without PEM wrapper
 * normalizePublicKey("MIIBIjANBgkqhki...")
 */
export function normalizePublicKey(raw: string): string {
  if (!raw || !raw.trim()) {
    throw new Error(
      "Public key is empty. Provide an RSA public key in PEM format.",
    );
  }

  // 1. Replace literal \n / \r\n with real newlines
  let pem = raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  // 2. Trim leading/trailing whitespace
  pem = pem.trim();

  // 3. Detect whether PEM headers are present
  const hasSpkiHeader = pem.includes(SPKI_HEADER);
  const hasPkcs1PubHeader = pem.includes(PKCS1_PUB_HEADER);
  const hasHeader = hasSpkiHeader || hasPkcs1PubHeader;

  if (hasHeader) {
    // Strip headers/footers, extract pure base64
    const base64 = pem
      .replace(/-----BEGIN (?:RSA )?PUBLIC KEY-----/g, "")
      .replace(/-----END (?:RSA )?PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "");

    if (!base64) {
      throw new Error(
        "Public key contains PEM headers but no key data. Check the key content.",
      );
    }

    // Re-wrap to 64-char lines with the original header type
    const header = hasPkcs1PubHeader ? PKCS1_PUB_HEADER : SPKI_HEADER;
    const footer = hasPkcs1PubHeader ? PKCS1_PUB_FOOTER : SPKI_FOOTER;
    const wrapped = base64.match(/.{1,64}/g)!.join("\n");
    pem = `${header}\n${wrapped}\n${footer}`;
  } else {
    // No PEM header — treat as raw base64, wrap with SPKI headers
    const base64 = pem.replace(/\s+/g, "");

    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
      throw new Error(
        "Public key is not valid PEM or base64. Expected an RSA public key in PEM format or raw base64.",
      );
    }

    const wrapped = base64.match(/.{1,64}/g)!.join("\n");
    pem = `${SPKI_HEADER}\n${wrapped}\n${SPKI_FOOTER}`;
  }

  // 4. Validate the key is actually parseable by Node.js crypto
  try {
    createPublicKey(pem);
  } catch {
    throw new Error(
      "Public key could not be parsed. Ensure it is a valid RSA public key in SPKI or PKCS#1 (PEM) format.",
    );
  }

  return pem;
}

/**
 * Build canonical request string and sign with RSA-SHA256.
 *
 * Canonical request format:
 *   METHOD\nPATH\nTIMESTAMP\nSHA256(BODY)
 *
 * @param method - HTTP method (e.g. "POST")
 * @param path - Request path (e.g. "/v1/actions/store/create-store")
 * @param timestamp - Unix epoch seconds string
 * @param body - Serialized JSON body
 * @param privateKey - RSA private key in PEM format
 * @returns Base64-encoded RSA-SHA256 signature
 */
export function signRequest(
  method: string,
  path: string,
  timestamp: string,
  body: string,
  privateKey: string,
): string {
  const bodyHash = createHash("sha256").update(body).digest("base64");
  const canonicalRequest = `${method}\n${path}\n${timestamp}\n${bodyHash}`;

  const sign = createSign("sha256");
  sign.update(canonicalRequest);
  return sign.sign(privateKey, "base64");
}
