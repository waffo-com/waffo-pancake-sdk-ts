import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";

const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function createMockFetch(handler: (url: string, options: RequestInit) => object) {
  return vi.fn(async (url: string, options: RequestInit) => ({
    status: 200,
    json: () => Promise.resolve(handler(url, options)),
  }));
}

function createClient(mockFetch: ReturnType<typeof vi.fn>) {
  return new WaffoPancake({
    merchantId: "MER_0000000000000000000000",
    privateKey: TEST_PRIVATE_KEY,
    baseUrl: "https://api.test.com",
    fetch: mockFetch as unknown as typeof fetch,
  });
}

describe("auth.issueSessionToken", () => {
  it("should issue a token with storeId", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { token: "jwt-token", expiresAt: "2026-04-02T10:00:00.000Z" },
    }));
    const client = createClient(mockFetch);

    const result = await client.auth.issueSessionToken({
      storeId: "STO_0000000000000000000000",
      buyerIdentity: "customer@example.com",
    });

    expect(result.token).toBe("jwt-token");
    expect(result.expiresAt).toBe("2026-04-02T10:00:00.000Z");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/auth/issue-session-token");
    const body = JSON.parse(options.body as string);
    expect(body.storeId).toBe("STO_0000000000000000000000");
    expect(body.buyerIdentity).toBe("customer@example.com");
  });

  it("should issue a token with productId", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { token: "jwt-token-2", expiresAt: "2026-04-02T10:00:00.000Z" },
    }));
    const client = createClient(mockFetch);

    const result = await client.auth.issueSessionToken({
      productId: "PROD_0000000000000000000000",
      buyerIdentity: "customer@example.com",
    });

    expect(result.token).toBe("jwt-token-2");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.productId).toBe("PROD_0000000000000000000000");
  });

  it("should reject when neither storeId nor productId is provided", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.auth.issueSessionToken({
        buyerIdentity: "customer@example.com",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });

  it("should reject invalid storeId format", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.auth.issueSessionToken({
        storeId: "bad-store-id",
        buyerIdentity: "customer@example.com",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });

  it("should reject invalid productId format", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.auth.issueSessionToken({
        productId: "bad-product-id",
        buyerIdentity: "customer@example.com",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });

  it("should reject missing buyerIdentity", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.auth.issueSessionToken({
        storeId: "STO_0000000000000000000000",
        buyerIdentity: "",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});
