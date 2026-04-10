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

function createErrorFetch(status: number, errors: Array<{ message: string; layer: string }>) {
  return vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve({ data: null, errors }),
  });
}

function createClient(mockFetch: ReturnType<typeof vi.fn>) {
  return new WaffoPancake({
    merchantId: "MER_test123",
    privateKey: TEST_PRIVATE_KEY,
    baseUrl: "https://api.test.com",
    fetch: mockFetch as unknown as typeof fetch,
  });
}

describe("checkout.anonymous", () => {
  it("should create a checkout session with minimal params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        sessionId: "cs_abc123",
        checkoutUrl: "https://pancake.waffo.ai/store/my-store/checkout/cs_abc123",
        expiresAt: "2026-04-02T10:00:00.000Z",
      },
    }));
    const client = createClient(mockFetch);

    const result = await client.checkout.anonymous.create({
      productId: "PROD_xxx",
      currency: "USD",
    });

    expect(result.sessionId).toBe("cs_abc123");
    expect(result.checkoutUrl).toBe("https://pancake.waffo.ai/store/my-store/checkout/cs_abc123");
    expect(result.expiresAt).toBe("2026-04-02T10:00:00.000Z");
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/checkout/create-session");
    const body = JSON.parse(options.body as string);
    expect(body.productId).toBe("PROD_xxx");
    expect(body.currency).toBe("USD");
  });

  it("should pass optional params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        sessionId: "cs_opt",
        checkoutUrl: "https://pancake.waffo.ai/store/s/checkout/cs_opt",
        expiresAt: "2026-04-02T10:00:00.000Z",
      },
    }));
    const client = createClient(mockFetch);

    await client.checkout.anonymous.create({
      productId: "PROD_xxx",
      currency: "JPY",
      priceSnapshot: { amount: "1000", taxCategory: "saas" },
      withTrial: true,
      successUrl: "https://example.com/success",
      darkMode: true,
      metadata: { ref: "campaign_1" },
      expiresInSeconds: 1800,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.priceSnapshot).toEqual({ amount: "1000", taxCategory: "saas" });
    expect(body.withTrial).toBe(true);
    expect(body.successUrl).toBe("https://example.com/success");
    expect(body.darkMode).toBe(true);
    expect(body.metadata).toEqual({ ref: "campaign_1" });
    expect(body.expiresInSeconds).toBe(1800);
  });

  it("should propagate API errors", async () => {
    const mockFetch = createErrorFetch(400, [{ message: "Invalid product", layer: "order" }]);
    const client = createClient(mockFetch);

    await expect(
      client.checkout.anonymous.create({
        productId: "PROD_invalid",
        currency: "USD",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("checkout.authenticated", () => {
  it("should issue token and create session in parallel, appending token to URL", async () => {
    const mockFetch = createMockFetch((url) => {
      if (url.includes("issue-session-token")) {
        return {
          data: {
            token: "eyJhbGciOi.test.jwt",
            expiresAt: "2026-04-02T09:05:00.000Z",
          },
        };
      }
      return {
        data: {
          sessionId: "cs_auth456",
          checkoutUrl: "https://pancake.waffo.ai/store/my-store/checkout/cs_auth456",
          expiresAt: "2026-04-02T10:00:00.000Z",
        },
      };
    });
    const client = createClient(mockFetch);

    const result = await client.checkout.authenticated.create({
      productId: "PROD_xxx",
      currency: "USD",
      buyerIdentity: "customer@example.com",
    });

    expect(result.sessionId).toBe("cs_auth456");
    expect(result.checkoutUrl).toBe("https://pancake.waffo.ai/store/my-store/checkout/cs_auth456#token=eyJhbGciOi.test.jwt");
    expect(result.expiresAt).toBe("2026-04-02T10:00:00.000Z");
    expect(result.token).toBe("eyJhbGciOi.test.jwt");
    expect(result.tokenExpiresAt).toBe("2026-04-02T09:05:00.000Z");

    // Two parallel calls: issue-session-token + create-session
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should default buyerEmail to buyerIdentity", async () => {
    const mockFetch = createMockFetch((url) => {
      if (url.includes("issue-session-token")) {
        return { data: { token: "jwt", expiresAt: "2026-04-02T09:05:00.000Z" } };
      }
      return {
        data: {
          sessionId: "cs_def",
          checkoutUrl: "https://pancake.waffo.ai/checkout/cs_def",
          expiresAt: "2026-04-02T10:00:00.000Z",
        },
      };
    });
    const client = createClient(mockFetch);

    await client.checkout.authenticated.create({
      productId: "PROD_xxx",
      currency: "USD",
      buyerIdentity: "buyer@test.com",
    });

    // Find the create-session call
    const sessionCall = mockFetch.mock.calls.find(([url]: [string]) => url.includes("create-session"));
    const sessionBody = JSON.parse(sessionCall![1].body as string);
    expect(sessionBody.buyerEmail).toBe("buyer@test.com");
  });

  it("should use explicit buyerEmail when provided", async () => {
    const mockFetch = createMockFetch((url) => {
      if (url.includes("issue-session-token")) {
        return { data: { token: "jwt", expiresAt: "2026-04-02T09:05:00.000Z" } };
      }
      return {
        data: {
          sessionId: "cs_exp",
          checkoutUrl: "https://pancake.waffo.ai/checkout/cs_exp",
          expiresAt: "2026-04-02T10:00:00.000Z",
        },
      };
    });
    const client = createClient(mockFetch);

    await client.checkout.authenticated.create({
      productId: "PROD_xxx",
      currency: "USD",
      buyerIdentity: "user-id-123",
      buyerEmail: "explicit@test.com",
    });

    const sessionCall = mockFetch.mock.calls.find(([url]: [string]) => url.includes("create-session"));
    const sessionBody = JSON.parse(sessionCall![1].body as string);
    expect(sessionBody.buyerEmail).toBe("explicit@test.com");
  });

  it("should pass billingDetail to the session", async () => {
    const mockFetch = createMockFetch((url) => {
      if (url.includes("issue-session-token")) {
        return { data: { token: "jwt", expiresAt: "2026-04-02T09:05:00.000Z" } };
      }
      return {
        data: {
          sessionId: "cs_bill",
          checkoutUrl: "https://pancake.waffo.ai/checkout/cs_bill",
          expiresAt: "2026-04-02T10:00:00.000Z",
        },
      };
    });
    const client = createClient(mockFetch);

    await client.checkout.authenticated.create({
      productId: "PROD_xxx",
      currency: "USD",
      buyerIdentity: "customer@example.com",
      billingDetail: { country: "US", isBusiness: false, postcode: "10001" },
    });

    const sessionCall = mockFetch.mock.calls.find(([url]: [string]) => url.includes("create-session"));
    const sessionBody = JSON.parse(sessionCall![1].body as string);
    expect(sessionBody.billingDetail).toEqual({ country: "US", isBusiness: false, postcode: "10001" });
  });

  it("should send correct buyerIdentity and productId to issue-session-token", async () => {
    const mockFetch = createMockFetch((url) => {
      if (url.includes("issue-session-token")) {
        return { data: { token: "jwt", expiresAt: "2026-04-02T09:05:00.000Z" } };
      }
      return {
        data: {
          sessionId: "cs_id",
          checkoutUrl: "https://pancake.waffo.ai/checkout/cs_id",
          expiresAt: "2026-04-02T10:00:00.000Z",
        },
      };
    });
    const client = createClient(mockFetch);

    await client.checkout.authenticated.create({
      productId: "PROD_xxx",
      currency: "USD",
      buyerIdentity: "id-from-merchant",
    });

    const tokenCall = mockFetch.mock.calls.find(([url]: [string]) => url.includes("issue-session-token"));
    const tokenBody = JSON.parse(tokenCall![1].body as string);
    expect(tokenBody.buyerIdentity).toBe("id-from-merchant");
    expect(tokenBody.productId).toBe("PROD_xxx");
  });

  it("should pass optional checkout params (priceSnapshot, withTrial, etc.)", async () => {
    const mockFetch = createMockFetch((url) => {
      if (url.includes("issue-session-token")) {
        return { data: { token: "jwt", expiresAt: "2026-04-02T09:05:00.000Z" } };
      }
      return {
        data: {
          sessionId: "cs_opts",
          checkoutUrl: "https://pancake.waffo.ai/checkout/cs_opts",
          expiresAt: "2026-04-02T10:00:00.000Z",
        },
      };
    });
    const client = createClient(mockFetch);

    await client.checkout.authenticated.create({
      productId: "PROD_xxx",
      currency: "EUR",
      buyerIdentity: "customer@example.com",
      priceSnapshot: { amount: "8.99", taxCategory: "saas" },
      withTrial: false,
      successUrl: "https://merchant.com/done",
      darkMode: false,
      metadata: { campaign: "spring" },
      expiresInSeconds: 900,
    });

    const sessionCall = mockFetch.mock.calls.find(([url]: [string]) => url.includes("create-session"));
    const sessionBody = JSON.parse(sessionCall![1].body as string);
    expect(sessionBody.priceSnapshot).toEqual({ amount: "8.99", taxCategory: "saas" });
    expect(sessionBody.withTrial).toBe(false);
    expect(sessionBody.successUrl).toBe("https://merchant.com/done");
    expect(sessionBody.darkMode).toBe(false);
    expect(sessionBody.metadata).toEqual({ campaign: "spring" });
    expect(sessionBody.expiresInSeconds).toBe(900);
    // buyerIdentity should not leak into session body
    expect(sessionBody.buyerIdentity).toBeUndefined();
  });

  it("should propagate API errors from issue-session-token", async () => {
    const mockFetch = createErrorFetch(401, [{ message: "Unauthorized", layer: "gateway" }]);
    const client = createClient(mockFetch);

    await expect(
      client.checkout.authenticated.create({
        productId: "PROD_xxx",
        currency: "USD",
        buyerIdentity: "customer@example.com",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("checkout.createSession (low-level)", () => {
  it("should still work as before", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        sessionId: "cs_low",
        checkoutUrl: "https://pancake.waffo.ai/checkout/cs_low",
        expiresAt: "2026-04-02T10:00:00.000Z",
      },
    }));
    const client = createClient(mockFetch);

    const result = await client.checkout.createSession({
      productId: "PROD_xxx",
      currency: "USD",
      buyerEmail: "test@example.com",
    });

    expect(result.sessionId).toBe("cs_low");
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
