import { createHash, createSign } from "node:crypto";

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
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonicalRequest = `${method}\n${path}\n${timestamp}\n${bodyHash}`;

  const sign = createSign("sha256");
  sign.update(canonicalRequest);
  return sign.sign(privateKey, "base64");
}
