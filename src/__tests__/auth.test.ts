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

describe("auth.createCustomerPortalLink", () => {
  const STORE_ID = "STO_0000000000000000000000";
  const PORTAL_URL = `https://pancake.waffo.ai/consumer/portal/store/${STORE_ID}`;

  it("should request a portal token and append it to portalUrl as a fragment", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { token: "portal-jwt", expiresAt: "2026-04-02T10:15:00.000Z", portalUrl: PORTAL_URL },
    }));
    const client = createClient(mockFetch);

    const result = await client.auth.createCustomerPortalLink({
      storeId: STORE_ID,
      buyerIdentity: "merchant-customer-123",
    });

    expect(result).toEqual({
      portalUrl: `${PORTAL_URL}#token=portal-jwt`,
      expiresAt: "2026-04-02T10:15:00.000Z",
    });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/auth/issue-session-token");
    expect(JSON.parse(options.body as string)).toEqual({
      storeId: STORE_ID,
      buyerIdentity: "merchant-customer-123",
      purpose: "portal",
    });
  });

  it("should not send fields other than storeId, buyerIdentity and purpose", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { token: "portal-jwt", expiresAt: "2026-04-02T10:15:00.000Z", portalUrl: PORTAL_URL },
    }));
    const client = createClient(mockFetch);

    await client.auth.createCustomerPortalLink({
      storeId: STORE_ID,
      buyerIdentity: "merchant-customer-123",
      productId: "PROD_0000000000000000000000",
    } as Parameters<typeof client.auth.createCustomerPortalLink>[0]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty("productId");
  });

  it("should forward the idempotency key when given", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { token: "portal-jwt", expiresAt: "2026-04-02T10:15:00.000Z", portalUrl: PORTAL_URL },
    }));
    const client = createClient(mockFetch);

    await client.auth.createCustomerPortalLink(
      { storeId: STORE_ID, buyerIdentity: "merchant-customer-123" },
      { idempotencyKey: "portal-link-1" },
    );

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Idempotency-Key"]).toBe("portal-link-1");
  });

  it("should carry warnings from the envelope", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { token: "portal-jwt", expiresAt: "2026-04-02T10:15:00.000Z", portalUrl: PORTAL_URL },
      warnings: [{ message: "heads up", layer: "user" }],
    }));
    const client = createClient(mockFetch);

    const result = await client.auth.createCustomerPortalLink({ storeId: STORE_ID, buyerIdentity: "u-1" });

    expect(result.warnings).toEqual([{ message: "heads up", layer: "user" }]);
  });

  it("should throw an sdk-layer error when the response has no portalUrl", async () => {
    const client = createClient(
      createMockFetch(() => ({
        data: { token: "plain-jwt", expiresAt: "2026-04-02T10:15:00.000Z" },
      })),
    );

    const err = await client.auth.createCustomerPortalLink({ storeId: STORE_ID, buyerIdentity: "u-1" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(WaffoPancakeError);
    expect((err as WaffoPancakeError).errors[0].layer).toBe("sdk");
    expect((err as WaffoPancakeError).message).toContain("portalUrl");
  });

  it("should throw an sdk-layer error when the response has no token", async () => {
    const client = createClient(
      createMockFetch(() => ({
        data: { token: "", expiresAt: "2026-04-02T10:15:00.000Z", portalUrl: PORTAL_URL },
      })),
    );

    const err = await client.auth.createCustomerPortalLink({ storeId: STORE_ID, buyerIdentity: "u-1" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(WaffoPancakeError);
    expect((err as WaffoPancakeError).errors[0].layer).toBe("sdk");
    expect((err as WaffoPancakeError).message).toContain("token");
    expect((err as WaffoPancakeError).message).not.toContain(PORTAL_URL);
  });

  it("should surface API errors", async () => {
    const mockFetch = vi.fn(async () => ({
      status: 400,
      json: () => Promise.resolve({ data: null, errors: [{ message: "productId is not allowed", layer: "user" }] }),
    }));
    const client = createClient(mockFetch);

    const err = await client.auth.createCustomerPortalLink({ storeId: STORE_ID, buyerIdentity: "u-1" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(WaffoPancakeError);
    expect((err as WaffoPancakeError).status).toBe(400);
    expect((err as WaffoPancakeError).errors[0].layer).toBe("user");
  });

  it("should reject a missing or malformed storeId before sending", async () => {
    const mockFetch = createMockFetch(() => ({}));
    const client = createClient(mockFetch);

    await expect(client.auth.createCustomerPortalLink({ storeId: "", buyerIdentity: "u-1" })).rejects.toThrow(WaffoPancakeError);
    await expect(client.auth.createCustomerPortalLink({ storeId: "PROD_0000000000000000000000", buyerIdentity: "u-1" })).rejects.toThrow(
      WaffoPancakeError,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should reject an empty buyerIdentity before sending", async () => {
    const mockFetch = createMockFetch(() => ({}));
    const client = createClient(mockFetch);

    await expect(client.auth.createCustomerPortalLink({ storeId: STORE_ID, buyerIdentity: "  " })).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
