import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";
import { ChangeTiming } from "../types.js";

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
