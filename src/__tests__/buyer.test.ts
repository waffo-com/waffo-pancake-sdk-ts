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
    merchantId: "MER_test123",
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
      data: { orderId: "ORD_xxx", status: "canceling" },
    }));
    const client = createClient(mockFetch);
    const buyer = client.buyer("session-token-123");

    const result = await buyer.cancelSubscription({ orderId: "ORD_xxx" });

    expect(result.orderId).toBe("ORD_xxx");
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
      data: { orderId: "ORD_yyy", status: "canceled" },
    }));
    const buyer = createClient(mockFetch).buyer("token");

    const result = await buyer.cancelOnetimeOrder({ orderId: "ORD_yyy" });

    expect(result.status).toBe("canceled");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/onetime-order/cancel-order");
  });
});

describe("buyer.reactivateSubscription", () => {
  it("should reactivate a subscription", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orderId: "ORD_xxx", status: "active" },
    }));
    const buyer = createClient(mockFetch).buyer("token");

    const result = await buyer.reactivateSubscription({ orderId: "ORD_xxx" });

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
          id: "TKT_xxx",
          type: "refund",
          status: "pending",
          subjectId: "PAY_xxx",
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
      paymentId: "PAY_xxx",
      reason: "Product not as described",
      requestedAmount: { amount: "29.00", currency: "USD" },
    });

    expect(ticket.id).toBe("TKT_xxx");
    expect(ticket.status).toBe("pending");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.paymentId).toBe("PAY_xxx");
    expect(body.reason).toBe("Product not as described");
    expect(body.requestedAmount).toEqual({ amount: "29.00", currency: "USD" });
  });
});

describe("buyer.resubmitRefundTicket", () => {
  it("should resubmit a rejected ticket", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        ticket: {
          id: "TKT_xxx",
          type: "refund",
          status: "pending",
          subjectId: "PAY_xxx",
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
      ticketId: "TKT_xxx",
      paymentId: "PAY_xxx",
      reason: "Updated reason",
      requestedAmount: { amount: "29.00", currency: "USD" },
    });

    expect(ticket.versionNumber).toBe(2);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/refund-ticket/resubmit-ticket");
  });
});

describe("buyer.graphql.query", () => {
  it("should query with Bearer token", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { data: { orders: [{ id: "ORD_xxx", status: "completed" }] }, errors: null },
    }));
    const buyer = createClient(mockFetch).buyer("gql-token");

    const result = await buyer.graphql.query({
      query: `query { orders { id status } }`,
    });

    expect(result.data?.orders).toHaveLength(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/graphql");
    expect(options.headers.Authorization).toBe("Bearer gql-token");
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

    await expect(buyer.cancelSubscription({ orderId: "ORD_xxx" })).rejects.toThrow(WaffoPancakeError);
  });
});
