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

describe("client.buyer()", () => {
  it("should create a buyer session", () => {
    const client = createClient(vi.fn());
    const buyer = client.buyer("test-token");
    expect(buyer).toBeDefined();
    expect(buyer.graphql).toBeDefined();
  });
});

describe("buyer.cancelSubscription", () => {
  it("should send Bearer token and return result", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orderId: "ORD_0000000000000000000000", status: "canceling" },
    }));
    const client = createClient(mockFetch);
    const buyer = client.buyer("session-token-123");

    const result = await buyer.cancelSubscription({ orderId: "ORD_0000000000000000000000" });

    expect(result.orderId).toBe("ORD_0000000000000000000000");
    expect(result.status).toBe("canceling");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-order/cancel-order");
    expect(options.headers.Authorization).toBe("Bearer session-token-123");
    expect(options.headers["X-Merchant-Id"]).toBeUndefined();
    expect(options.headers["X-Signature"]).toBeUndefined();
  });
});

describe("buyer.cancelOnetimeOrder", () => {
  it("should cancel a one-time order", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orderId: "ORD_1111111111111111111111", status: "canceled" },
    }));
    const buyer = createClient(mockFetch).buyer("token");

    const result = await buyer.cancelOnetimeOrder({ orderId: "ORD_1111111111111111111111" });

    expect(result.status).toBe("canceled");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/onetime-order/cancel-order");
  });
});

describe("buyer.reactivateSubscription", () => {
  it("should reactivate a subscription", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orderId: "ORD_0000000000000000000000", status: "active" },
    }));
    const buyer = createClient(mockFetch).buyer("token");

    const result = await buyer.reactivateSubscription({ orderId: "ORD_0000000000000000000000" });

    expect(result.status).toBe("active");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-order/reactivate-order");
  });
});

describe("buyer.createRefundTicket", () => {
  it("should create a refund ticket with all params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        ticket: {
          id: "TKT_0000000000000000000000",
          type: "refund",
          status: "pending",
          subjectId: "PAY_0000000000000000000000",
          submitterId: "buyer@test.com",
          submitterType: "customer",
          currentVersionId: "TVER_xxx",
          reviewerId: null,
          reviewedAt: null,
          reviewNote: null,
          rejectReason: null,
          executedAt: null,
          metadata: {},
          versionNumber: 1,
          versionData: { reason: "Product not as described" },
        },
      },
    }));
    const buyer = createClient(mockFetch).buyer("token");

    const { ticket } = await buyer.createRefundTicket({
      paymentId: "PAY_0000000000000000000000",
      reason: "Product not as described",
      requestedAmount: { amount: "29.00", currency: "USD" },
    });

    expect(ticket.id).toBe("TKT_0000000000000000000000");
    expect(ticket.status).toBe("pending");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.paymentId).toBe("PAY_0000000000000000000000");
    expect(body.reason).toBe("Product not as described");
    expect(body.requestedAmount).toEqual({ amount: "29.00", currency: "USD" });
  });

  it("should forward refundTicketMerchantExternalId in the request body", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        ticket: {
          id: "TKT_0000000000000000000000",
          type: "refund",
          status: "pending",
          subjectId: "PAY_0000000000000000000000",
          submitterId: "buyer@test.com",
          submitterType: "customer",
          currentVersionId: "TVER_xxx",
          reviewerId: null,
          reviewedAt: null,
          reviewNote: null,
          rejectReason: null,
          executedAt: null,
          metadata: {},
          refundTicketMerchantExternalId: "REF-2026-00891",
          versionNumber: 1,
          versionData: { reason: "Product not as described" },
        },
      },
    }));
    const buyer = createClient(mockFetch).buyer("token");

    const { ticket } = await buyer.createRefundTicket({
      paymentId: "PAY_0000000000000000000000",
      reason: "Product not as described",
      requestedAmount: { amount: "29.00", currency: "USD" },
      refundTicketMerchantExternalId: "REF-2026-00891",
    });

    expect(ticket.refundTicketMerchantExternalId).toBe("REF-2026-00891");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.refundTicketMerchantExternalId).toBe("REF-2026-00891");
  });

  it("should reject refundTicketMerchantExternalId exceeding 128 characters", async () => {
    const mockFetch = vi.fn();
    const buyer = createClient(mockFetch).buyer("token");

    await expect(
      buyer.createRefundTicket({
        paymentId: "PAY_0000000000000000000000",
        reason: "Product not as described",
        requestedAmount: { amount: "29.00", currency: "USD" },
        refundTicketMerchantExternalId: "x".repeat(129),
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("buyer.resubmitRefundTicket", () => {
  it("should resubmit a rejected ticket", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        ticket: {
          id: "TKT_0000000000000000000000",
          type: "refund",
          status: "pending",
          subjectId: "PAY_0000000000000000000000",
          submitterId: "buyer@test.com",
          submitterType: "customer",
          currentVersionId: "TVER_yyy",
          reviewerId: null,
          reviewedAt: null,
          reviewNote: null,
          rejectReason: null,
          executedAt: null,
          metadata: {},
          versionNumber: 2,
          versionData: { reason: "Updated reason" },
        },
      },
    }));
    const buyer = createClient(mockFetch).buyer("token");

    const { ticket } = await buyer.resubmitRefundTicket({
      ticketId: "TKT_0000000000000000000000",
      paymentId: "PAY_0000000000000000000000",
      reason: "Updated reason",
      requestedAmount: { amount: "29.00", currency: "USD" },
    });

    expect(ticket.versionNumber).toBe(2);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/refund-ticket/resubmit-ticket");
  });
});

describe("buyer.graphql.query", () => {
  it("returns the standard GraphQL envelope verbatim with Bearer auth", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orders: [{ id: "ORD_0000000000000000000000", status: "completed" }] },
    }));
    const buyer = createClient(mockFetch).buyer("gql-token");

    const result = await buyer.graphql.query<{ orders: Array<{ id: string; status: string }> }>({
      query: `query { orders { id status } }`,
    });

    expect(result.data?.orders).toHaveLength(1);
    expect(result.data?.orders[0]?.id).toBe("ORD_0000000000000000000000");
    expect(result.errors).toBeUndefined();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/graphql");
    expect(options.headers.Authorization).toBe("Bearer gql-token");
  });

  it("preserves partial-success envelope (data + errors)", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orders: null },
      errors: [{ message: "resolver crashed", path: ["orders"] }],
    }));
    const buyer = createClient(mockFetch).buyer("gql-token");

    const result = await buyer.graphql.query({ query: `query { orders { id } }` });

    expect(result.data?.orders).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.message).toBe("resolver crashed");
  });

  it("returns the envelope on HTTP 4xx instead of throwing", async () => {
    const mockFetch = vi.fn(async () => ({
      status: 401,
      json: () => Promise.resolve({ data: null, errors: [{ message: "Session expired", layer: "gateway" }] }),
    }));
    const buyer = createClient(mockFetch as unknown as ReturnType<typeof vi.fn>).buyer("expired");

    const result = await buyer.graphql.query({ query: `query { orders { id } }` });

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.message).toBe("Session expired");
  });
});

describe("buyer error handling", () => {
  it("should throw WaffoPancakeError on API error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      json: () =>
        Promise.resolve({
          data: null,
          errors: [{ message: "Session expired", layer: "gateway" }],
        }),
    });
    const buyer = createClient(mockFetch as unknown as typeof vi.fn).buyer("expired-token");

    await expect(buyer.cancelSubscription({ orderId: "ORD_0000000000000000000000" })).rejects.toThrow(WaffoPancakeError);
  });
});
