import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";
import { ChangeTiming, TaxCategory } from "../types.js";

const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const ORIGIN_ORDER_ID = "ORD_0000000000000000000000";
const TARGET_PRODUCT_ID = "PROD_0000000000000000000000";

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

function bodyOf(mockFetch: ReturnType<typeof vi.fn>, pathFragment: string): Record<string, unknown> {
  const call = mockFetch.mock.calls.find((args) => String(args[0]).includes(pathFragment));
  return JSON.parse(String(call![1].body)) as Record<string, unknown>;
}

function changeSessionFetch(sessionId = "cs_change") {
  return createMockFetch((url) => {
    if (url.includes("issue-session-token")) {
      return { data: { token: "jwt.change", expiresAt: "2026-04-02T09:05:00.000Z" } };
    }
    return {
      data: {
        sessionId,
        checkoutUrl: `https://pancake.waffo.ai/store/my-store/change/${sessionId}`,
        expiresAt: "2026-04-02T10:00:00.000Z",
      },
    };
  });
}

describe("checkout.createPlanChangeSession", () => {
  it("should send the plan change fields to create-session and return a change URL", async () => {
    const mockFetch = changeSessionFetch();
    const client = createClient(mockFetch);

    const result = await client.checkout.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      changeTiming: ChangeTiming.Immediate,
      changeAmount: "12.00",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/checkout/create-session");

    const body = bodyOf(mockFetch, "create-session");
    expect(body.originOrderId).toBe(ORIGIN_ORDER_ID);
    expect(body.productId).toBe(TARGET_PRODUCT_ID);
    expect(body.changeTiming).toBe("immediate");
    expect(body.changeAmount).toBe("12.00");

    // The path segment after the store slug is `change`, not `checkout`
    expect(new URL(result.checkoutUrl).pathname.split("/")[3]).toBe("change");
  });

  it("should forward changeCreditAmount unchanged", async () => {
    const mockFetch = changeSessionFetch("cs_credit");
    const client = createClient(mockFetch);

    await client.checkout.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      changeCreditAmount: "8.00",
    });

    const body = bodyOf(mockFetch, "create-session");
    expect(body.changeCreditAmount).toBe("8.00");
    expect(body.changeAmount).toBeUndefined();
  });

  it("should forward both amount fields as sent, leaving the mutual exclusion to the platform", async () => {
    const mockFetch = changeSessionFetch("cs_both");
    const client = createClient(mockFetch);

    await client.checkout.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      changeAmount: "12.00",
      changeCreditAmount: "8.00",
    });

    // The SDK neither rejects nor drops one side — the platform answers with a 400
    const body = bodyOf(mockFetch, "create-session");
    expect(body.changeAmount).toBe("12.00");
    expect(body.changeCreditAmount).toBe("8.00");
  });

  it("should forward the optional session fields", async () => {
    const mockFetch = changeSessionFetch("cs_opts");
    const client = createClient(mockFetch);

    await client.checkout.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "EUR",
      changeTiming: ChangeTiming.NextPeriod,
      withTrial: false,
      successUrl: "https://merchant.com/done",
      expiresInSeconds: 900,
      darkMode: true,
      metadata: { campaign: "winback" },
      orderMerchantExternalId: "CHANGE-2026-00891",
      language: "ja-JP",
      includePaymentMethods: ["card"],
    });

    const body = bodyOf(mockFetch, "create-session");
    expect(body.changeTiming).toBe("next_period");
    expect(body.withTrial).toBe(false);
    expect(body.successUrl).toBe("https://merchant.com/done");
    expect(body.expiresInSeconds).toBe(900);
    expect(body.darkMode).toBe(true);
    expect(body.metadata).toEqual({ campaign: "winback" });
    expect(body.orderMerchantExternalId).toBe("CHANGE-2026-00891");
    expect(body.language).toBe("ja-JP");
    expect(body.includePaymentMethods).toEqual(["card"]);
  });

  it("should reject an originOrderId that is not an order Short ID", async () => {
    const mockFetch = vi.fn();
    const client = createClient(mockFetch);

    await expect(
      client.checkout.createPlanChangeSession({
        originOrderId: "PROD_0000000000000000000000",
        productId: TARGET_PRODUCT_ID,
        currency: "USD",
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should reject a malformed changeAmount before sending the request", async () => {
    const mockFetch = vi.fn();
    const client = createClient(mockFetch);

    await expect(
      client.checkout.createPlanChangeSession({
        originOrderId: ORIGIN_ORDER_ID,
        productId: TARGET_PRODUCT_ID,
        currency: "USD",
        changeAmount: "twelve",
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("checkout.authenticated.createPlanChange", () => {
  it("should issue a token and a change session, appending the token to the URL", async () => {
    const mockFetch = changeSessionFetch("cs_auth_change");
    const client = createClient(mockFetch);

    const result = await client.checkout.authenticated.createPlanChange({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      buyerIdentity: "user-123",
      changeTiming: ChangeTiming.NextPeriod,
      changeCreditAmount: "8.00",
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.checkoutUrl).toBe("https://pancake.waffo.ai/store/my-store/change/cs_auth_change#token=jwt.change");
    expect(result.token).toBe("jwt.change");
    expect(result.sessionId).toBe("cs_auth_change");

    const sessionBody = bodyOf(mockFetch, "create-session");
    expect(sessionBody.originOrderId).toBe(ORIGIN_ORDER_ID);
    expect(sessionBody.changeTiming).toBe("next_period");
    expect(sessionBody.changeCreditAmount).toBe("8.00");
    // buyerIdentity belongs to the token call only
    expect(sessionBody.buyerIdentity).toBeUndefined();

    const tokenBody = bodyOf(mockFetch, "issue-session-token");
    expect(tokenBody.buyerIdentity).toBe("user-123");
    expect(tokenBody.productId).toBe(TARGET_PRODUCT_ID);
    expect(tokenBody.originOrderId).toBeUndefined();
  });

  it("should reject a missing buyerIdentity before sending anything", async () => {
    const mockFetch = vi.fn();
    const client = createClient(mockFetch);

    await expect(
      client.checkout.authenticated.createPlanChange({
        originOrderId: ORIGIN_ORDER_ID,
        productId: TARGET_PRODUCT_ID,
        currency: "USD",
        buyerIdentity: "",
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("plan change surface (compile-time)", () => {
  it("should keep the plan change fields off the new-purchase and anonymous params", async () => {
    const mockFetch = changeSessionFetch("cs_new");
    const client = createClient(mockFetch);

    await client.checkout.createSession({
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      // @ts-expect-error — originOrderId is not part of the new-purchase params
      originOrderId: ORIGIN_ORDER_ID,
    });

    await client.checkout.anonymous.create({
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      // @ts-expect-error — changeTiming is not part of the anonymous params
      changeTiming: "immediate",
    });

    // Store Slug is an anonymous credential and a plan change has no subscription
    // to attribute, so the anonymous resource carries no plan change method.
    // @ts-expect-error — createPlanChangeSession does not exist on the anonymous resource
    expect(client.checkout.anonymous.createPlanChangeSession).toBeUndefined();
  });

  it("should require originOrderId on a plan change call", async () => {
    const mockFetch = vi.fn();
    const client = createClient(mockFetch);
    const paramsWithoutOrigin = { productId: TARGET_PRODUCT_ID, currency: "USD" };

    // @ts-expect-error — originOrderId is required; omitting it never compiles
    await expect(client.checkout.createPlanChangeSession(paramsWithoutOrigin)).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("customer.createPlanChangeSession", () => {
  function createCustomer(mockFetch: ReturnType<typeof vi.fn>) {
    return new WaffoPancake({
      merchantId: "MER_0000000000000000000000",
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: "https://api.test.com",
      environment: "test",
      fetch: mockFetch as unknown as typeof fetch,
    }).customer("customer.session.jwt");
  }

  it("should post to create-session with the customer bearer token and return a change URL", async () => {
    const mockFetch = changeSessionFetch("cs_self_service");
    const customer = createCustomer(mockFetch);

    const result = await customer.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      changeTiming: ChangeTiming.NextPeriod,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/checkout/create-session");

    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer customer.session.jwt");
    expect(headers["X-Environment"]).toBe("test");
    // No key unless the caller passes one — same rule as the API Key client
    expect(headers["X-Idempotency-Key"]).toBeUndefined();
    // ...and no merchant signature, so the platform treats it as a customer issuer
    expect(headers["X-Signature"]).toBeUndefined();

    const body = bodyOf(mockFetch, "create-session");
    expect(body.originOrderId).toBe(ORIGIN_ORDER_ID);
    expect(body.changeTiming).toBe("next_period");
    expect(new URL(result.checkoutUrl).pathname.split("/")[3]).toBe("change");
  });

  it("should validate ids and currency before sending the request", async () => {
    const mockFetch = vi.fn();
    const customer = createCustomer(mockFetch);

    await expect(
      customer.createPlanChangeSession({
        originOrderId: "not-an-order-id",
        productId: TARGET_PRODUCT_ID,
        currency: "USD",
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should not accept the merchant-only fields the platform would silently drop", async () => {
    const mockFetch = changeSessionFetch("cs_probe");
    const customer = createCustomer(mockFetch);

    await customer.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      // @ts-expect-error — changeAmount is merchant-credential only
      changeAmount: "12.00",
    });

    await customer.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      // @ts-expect-error — changeCreditAmount is merchant-credential only
      changeCreditAmount: "8.00",
    });

    await customer.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      // @ts-expect-error — withTrial is merchant-credential only
      withTrial: true,
    });

    await customer.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      // @ts-expect-error — priceSnapshot is merchant-credential only
      priceSnapshot: { amount: "9.99", taxCategory: TaxCategory.SaaS },
    });

    await customer.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
      // @ts-expect-error — orderMerchantExternalId is merchant-credential only
      orderMerchantExternalId: "CHANGE-2026-00891",
    });
  });
});

describe("idempotency key on plan change calls", () => {
  it("omits the header by default and sends the caller's key verbatim", async () => {
    const mockFetch = changeSessionFetch("cs_idem");
    const client = createClient(mockFetch);

    await client.checkout.createPlanChangeSession({
      originOrderId: ORIGIN_ORDER_ID,
      productId: TARGET_PRODUCT_ID,
      currency: "USD",
    });
    await client.checkout.createPlanChangeSession(
      { originOrderId: ORIGIN_ORDER_ID, productId: TARGET_PRODUCT_ID, currency: "USD" },
      { idempotencyKey: "MER_plan-change-2026-00891" },
    );

    const headersOf = (i: number) => mockFetch.mock.calls[i][1].headers as Record<string, string>;
    expect(headersOf(0)["X-Idempotency-Key"]).toBeUndefined();
    expect(headersOf(1)["X-Idempotency-Key"]).toBe("MER_plan-change-2026-00891");
  });

  it("applies the key to create-session only, never to the token call", async () => {
    const mockFetch = changeSessionFetch("cs_idem_auth");
    const client = createClient(mockFetch);

    await client.checkout.authenticated.createPlanChange(
      { originOrderId: ORIGIN_ORDER_ID, productId: TARGET_PRODUCT_ID, currency: "USD", buyerIdentity: "user-123" },
      { idempotencyKey: "MER_plan-change-2026-00892" },
    );

    const callFor = (fragment: string) => mockFetch.mock.calls.find((args) => String(args[0]).includes(fragment))!;
    const sessionHeaders = callFor("create-session")[1].headers as Record<string, string>;
    const tokenHeaders = callFor("issue-session-token")[1].headers as Record<string, string>;
    expect(sessionHeaders["X-Idempotency-Key"]).toBe("MER_plan-change-2026-00892");
    // One key cannot address two endpoints — the token call must not reuse it
    expect(tokenHeaders["X-Idempotency-Key"]).toBeUndefined();
  });

  it("sends the key on a customer session call when given one", async () => {
    const mockFetch = changeSessionFetch("cs_idem_self");
    const customer = new WaffoPancake({
      merchantId: "MER_0000000000000000000000",
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: "https://api.test.com",
      environment: "test",
      fetch: mockFetch as unknown as typeof fetch,
    }).customer("customer.session.jwt");

    await customer.createPlanChangeSession(
      { originOrderId: ORIGIN_ORDER_ID, productId: TARGET_PRODUCT_ID, currency: "USD" },
      { idempotencyKey: "MER_self-service-2026-00893" },
    );

    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Idempotency-Key"]).toBe("MER_self-service-2026-00893");
  });
});
