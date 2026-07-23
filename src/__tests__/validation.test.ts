import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";
import {
  validateAmountString,
  validateBillingDetail,
  validateCheckoutCommon,
  validateCountryCode,
  validateCurrencyCode,
  validateEnum,
  validateMaxLength,
  validatePaymentMethods,
  validatePositiveInteger,
  validatePrices,
  validateRequired,
  validateShortId,
} from "../validation.js";

const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// ---------------------------------------------------------------------------
// Unit tests for validation functions
// ---------------------------------------------------------------------------

describe("validateRequired", () => {
  it("should pass for non-empty string", () => {
    expect(() => validateRequired("field", "value")).not.toThrow();
  });

  it("should throw WaffoPancakeError for undefined", () => {
    expect(() => validateRequired("field", undefined)).toThrow(WaffoPancakeError);
  });

  it("should throw for null", () => {
    expect(() => validateRequired("field", null)).toThrow(WaffoPancakeError);
  });

  it("should throw for empty string", () => {
    expect(() => validateRequired("field", "")).toThrow(WaffoPancakeError);
  });

  it("should throw for whitespace-only string", () => {
    expect(() => validateRequired("field", "   ")).toThrow(WaffoPancakeError);
  });

  it("should include field name in error message", () => {
    try {
      validateRequired("storeId", undefined);
    } catch (e) {
      expect((e as WaffoPancakeError).errors[0].message).toContain("storeId");
      expect((e as WaffoPancakeError).errors[0].layer).toBe("sdk");
      expect((e as WaffoPancakeError).status).toBe(400);
    }
  });
});

describe("validateShortId", () => {
  it("should pass for valid STO_ id", () => {
    expect(() => validateShortId("storeId", "STO_2aUyqjCzEIiEcYMKj7TZtw", "STO")).not.toThrow();
  });

  it("should pass for valid PROD_ id", () => {
    expect(() => validateShortId("productId", "PROD_4cWAslE1GKkGeaOMl9Vbmy", "PROD")).not.toThrow();
  });

  it("should throw for wrong prefix", () => {
    expect(() => validateShortId("storeId", "PROD_xxx", "STO")).toThrow(WaffoPancakeError);
  });

  it("should throw for no underscore", () => {
    expect(() => validateShortId("storeId", "STOxxx", "STO")).toThrow(WaffoPancakeError);
  });

  it("should throw for lowercase prefix", () => {
    expect(() => validateShortId("storeId", "sto_xxx", "STO")).toThrow(WaffoPancakeError);
  });

  it("should throw for UUID format", () => {
    expect(() => validateShortId("storeId", "550e8400-e29b-41d4-a716-446655440000", "STO")).toThrow(WaffoPancakeError);
  });

  it("should throw for empty string", () => {
    expect(() => validateShortId("storeId", "", "STO")).toThrow(WaffoPancakeError);
  });

  it("should include helpful error message", () => {
    try {
      validateShortId("storeId", "bad-id", "STO");
    } catch (e) {
      const msg = (e as WaffoPancakeError).errors[0].message;
      expect(msg).toContain("Store");
      expect(msg).toContain("STO_xxx");
    }
  });
});

describe("validateCurrencyCode", () => {
  it("should pass for USD", () => {
    expect(() => validateCurrencyCode("currency", "USD")).not.toThrow();
  });

  it("should pass for JPY", () => {
    expect(() => validateCurrencyCode("currency", "JPY")).not.toThrow();
  });

  it("should throw for lowercase", () => {
    expect(() => validateCurrencyCode("currency", "usd")).toThrow(WaffoPancakeError);
  });

  it("should throw for 2-letter code", () => {
    expect(() => validateCurrencyCode("currency", "US")).toThrow(WaffoPancakeError);
  });

  it("should throw for 4-letter code", () => {
    expect(() => validateCurrencyCode("currency", "USDD")).toThrow(WaffoPancakeError);
  });
});

describe("validateAmountString", () => {
  it("should pass for integer string", () => {
    expect(() => validateAmountString("amount", "1000")).not.toThrow();
  });

  it("should pass for decimal string", () => {
    expect(() => validateAmountString("amount", "9.99")).not.toThrow();
  });

  it("should pass for zero", () => {
    expect(() => validateAmountString("amount", "0")).not.toThrow();
  });

  it("should throw for negative", () => {
    expect(() => validateAmountString("amount", "-9.99")).toThrow(WaffoPancakeError);
  });

  it("should throw for non-numeric", () => {
    expect(() => validateAmountString("amount", "abc")).toThrow(WaffoPancakeError);
  });

  it("should throw for empty string", () => {
    expect(() => validateAmountString("amount", "")).toThrow(WaffoPancakeError);
  });
});

describe("validateEnum", () => {
  it("should pass for valid value", () => {
    expect(() => validateEnum("productType", "onetime", ["onetime", "subscription"])).not.toThrow();
  });

  it("should throw for invalid value", () => {
    expect(() => validateEnum("productType", "invalid", ["onetime", "subscription"])).toThrow(WaffoPancakeError);
  });

  it("should list allowed values in error", () => {
    try {
      validateEnum("status", "bad", ["active", "inactive"]);
    } catch (e) {
      expect((e as WaffoPancakeError).errors[0].message).toContain("active, inactive");
    }
  });
});

describe("validatePositiveInteger", () => {
  it("should pass for positive integer", () => {
    expect(() => validatePositiveInteger("expiresInSeconds", 2700)).not.toThrow();
  });

  it("should throw for zero", () => {
    expect(() => validatePositiveInteger("expiresInSeconds", 0)).toThrow(WaffoPancakeError);
  });

  it("should throw for negative", () => {
    expect(() => validatePositiveInteger("expiresInSeconds", -1)).toThrow(WaffoPancakeError);
  });

  it("should throw for float", () => {
    expect(() => validatePositiveInteger("expiresInSeconds", 1.5)).toThrow(WaffoPancakeError);
  });
});

describe("validateMaxLength", () => {
  it("should pass for undefined (optional field omitted)", () => {
    expect(() => validateMaxLength("orderMerchantExternalId", undefined, 128)).not.toThrow();
  });

  it("should pass at the boundary", () => {
    expect(() => validateMaxLength("orderMerchantExternalId", "x".repeat(128), 128)).not.toThrow();
  });

  it("should throw when value exceeds max", () => {
    expect(() => validateMaxLength("orderMerchantExternalId", "x".repeat(129), 128)).toThrow(WaffoPancakeError);
  });
});

describe("validateCountryCode", () => {
  it("should pass for US", () => {
    expect(() => validateCountryCode("country", "US")).not.toThrow();
  });

  it("should throw for lowercase", () => {
    expect(() => validateCountryCode("country", "us")).toThrow(WaffoPancakeError);
  });

  it("should throw for 3-letter code", () => {
    expect(() => validateCountryCode("country", "USA")).toThrow(WaffoPancakeError);
  });
});

describe("validatePrices", () => {
  it("should pass for valid prices", () => {
    expect(() => validatePrices("prices", { USD: { amount: "9.99", taxCategory: "saas" } })).not.toThrow();
  });

  it("should pass for multi-currency", () => {
    expect(() =>
      validatePrices("prices", {
        USD: { amount: "29.00", taxCategory: "digital_goods" },
        EUR: { amount: "27.00", taxCategory: "digital_goods" },
      }),
    ).not.toThrow();
  });

  it("should throw for empty prices", () => {
    expect(() => validatePrices("prices", {})).toThrow(WaffoPancakeError);
  });

  it("should throw for invalid currency key", () => {
    expect(() => validatePrices("prices", { usd: { amount: "9.99", taxCategory: "saas" } })).toThrow(WaffoPancakeError);
  });

  it("should throw for invalid amount", () => {
    expect(() => validatePrices("prices", { USD: { amount: "abc", taxCategory: "saas" } })).toThrow(WaffoPancakeError);
  });
});

describe("validateBillingDetail", () => {
  it("should pass for valid detail", () => {
    expect(() => validateBillingDetail({ country: "US", isBusiness: false })).not.toThrow();
  });

  it("should throw for invalid country", () => {
    expect(() => validateBillingDetail({ country: "usa", isBusiness: false })).toThrow(WaffoPancakeError);
  });
});

describe("validateCheckoutCommon", () => {
  const valid = { productId: "PROD_0000000000000000000000", currency: "USD" };

  it("should pass for valid params", () => {
    expect(() => validateCheckoutCommon(valid)).not.toThrow();
  });

  it("should validate priceSnapshot when present", () => {
    expect(() => validateCheckoutCommon({ ...valid, priceSnapshot: { amount: "abc", taxCategory: "saas" } })).toThrow(WaffoPancakeError);
  });

  it("should validate expiresInSeconds when present", () => {
    expect(() => validateCheckoutCommon({ ...valid, expiresInSeconds: -1 })).toThrow(WaffoPancakeError);
  });

  it("should validate billingDetail when present", () => {
    expect(() => validateCheckoutCommon({ ...valid, billingDetail: { country: "usa", isBusiness: false } })).toThrow(WaffoPancakeError);
  });

  it("should pass when paymentMethods is a valid non-empty ordered list", () => {
    expect(() => validateCheckoutCommon({ ...valid, paymentMethods: ["APPLEPAY", "CREDITCARD"] })).not.toThrow();
  });

  it("should throw when paymentMethods is an empty array", () => {
    expect(() => validateCheckoutCommon({ ...valid, paymentMethods: [] })).toThrow(WaffoPancakeError);
  });

  it("should throw when paymentMethods contains an unknown identifier", () => {
    expect(() => validateCheckoutCommon({ ...valid, paymentMethods: ["ALIPAY"] as never })).toThrow(WaffoPancakeError);
  });

  it("should throw when paymentMethods contains duplicates", () => {
    expect(() => validateCheckoutCommon({ ...valid, paymentMethods: ["CREDITCARD", "CREDITCARD"] })).toThrow(WaffoPancakeError);
  });
});

describe("validatePaymentMethods", () => {
  it("should pass for a valid non-empty ordered list", () => {
    expect(() => validatePaymentMethods("paymentMethods", ["APPLEPAY", "CREDITCARD"])).not.toThrow();
  });

  it("should pass when omitted (undefined)", () => {
    expect(() => validatePaymentMethods("paymentMethods", undefined)).not.toThrow();
  });

  it("should throw for an empty array", () => {
    expect(() => validatePaymentMethods("paymentMethods", [])).toThrow(WaffoPancakeError);
  });

  it("should throw for an unknown identifier", () => {
    expect(() => validatePaymentMethods("paymentMethods", ["WECHAT"] as never)).toThrow(WaffoPancakeError);
  });

  it("should throw for duplicate values", () => {
    expect(() => validatePaymentMethods("paymentMethods", ["GOOGLEPAY", "GOOGLEPAY"])).toThrow(WaffoPancakeError);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — validation fires before HTTP call
// ---------------------------------------------------------------------------

describe("integration: validation prevents network request", () => {
  function createClient() {
    const mockFetch = vi.fn();
    const client = new WaffoPancake({
      merchantId: "MER_0000000000000000000000",
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: "https://api.test.com",
      fetch: mockFetch as unknown as typeof fetch,
    });
    return { client, mockFetch };
  }

  it("auth.issueSessionToken — missing storeId and productId", async () => {
    const { client, mockFetch } = createClient();
    await expect(client.auth.issueSessionToken({ buyerIdentity: "a@b.com" })).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("auth.issueSessionToken — invalid storeId format", async () => {
    const { client, mockFetch } = createClient();
    await expect(client.auth.issueSessionToken({ storeId: "bad", buyerIdentity: "a@b.com" })).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("stores.create — empty name", async () => {
    const { client, mockFetch } = createClient();
    await expect(client.stores.create({ name: "" })).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("onetimeProducts.create — invalid prices", async () => {
    const { client, mockFetch } = createClient();
    await expect(
      client.onetimeProducts.create({
        storeId: "STO_0000000000000000000000",
        name: "Test",
        prices: {},
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("checkout.authenticated.create — missing buyerIdentity", async () => {
    const { client, mockFetch } = createClient();
    await expect(
      client.checkout.authenticated.create({
        productId: "PROD_0000000000000000000000",
        currency: "USD",
        buyerIdentity: "",
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("checkout.anonymous.create — invalid currency", async () => {
    const { client, mockFetch } = createClient();
    await expect(
      client.checkout.anonymous.create({
        productId: "PROD_0000000000000000000000",
        currency: "usd",
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("customer.createRefundTicket — invalid paymentId", async () => {
    const { client, mockFetch } = createClient();
    const customer = client.customer("token");
    await expect(
      customer.createRefundTicket({
        paymentId: "bad",
        reason: "test",
        requestedAmount: { amount: "9.99", currency: "USD" },
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("orders.cancelSubscription — invalid orderId", async () => {
    const { client, mockFetch } = createClient();
    await expect(client.orders.cancelSubscription({ orderId: "bad" })).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("graphql.query — empty query", async () => {
    const { client, mockFetch } = createClient();
    await expect(client.graphql.query({ query: "" })).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("error has status 400 and layer sdk", async () => {
    const { client } = createClient();
    try {
      await client.stores.create({ name: "" });
    } catch (e) {
      expect(e).toBeInstanceOf(WaffoPancakeError);
      expect((e as WaffoPancakeError).status).toBe(400);
      expect((e as WaffoPancakeError).errors[0].layer).toBe("sdk");
    }
  });
});
