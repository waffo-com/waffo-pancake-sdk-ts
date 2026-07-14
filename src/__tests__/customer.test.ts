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

describe("client.customer()", () => {
  it("should create a customer session", () => {
    const client = createClient(vi.fn());
    const customer = client.customer("test-token");
    expect(customer).toBeDefined();
    expect(customer.graphql).toBeDefined();
  });
});

describe("client.buyer() (deprecated alias)", () => {
  it("should return a working customer session", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orderId: "ORD_0000000000000000000000", status: "canceling" },
    }));
    const client = createClient(mockFetch);
    const session = client.buyer("session-token-123");

    expect(session.graphql).toBeDefined();

    const result = await session.cancelSubscription({ orderId: "ORD_0000000000000000000000" });
    expect(result.status).toBe("canceling");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-order/cancel-order");
    expect(options.headers.Authorization).toBe("Bearer session-token-123");
  });
});

describe("customer.cancelSubscription", () => {
  it("should send Bearer token and return result", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orderId: "ORD_0000000000000000000000", status: "canceling" },
    }));
    const client = createClient(mockFetch);
    const customer = client.customer("session-token-123");

    const result = await customer.cancelSubscription({ orderId: "ORD_0000000000000000000000" });

    expect(result.orderId).toBe("ORD_0000000000000000000000");
    expect(result.status).toBe("canceling");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-order/cancel-order");
    expect(options.headers.Authorization).toBe("Bearer session-token-123");
    expect(options.headers["X-Merchant-Id"]).toBeUndefined();
    expect(options.headers["X-Signature"]).toBeUndefined();
  });
});

describe("customer.cancelOnetimeOrder", () => {
  it("should cancel a one-time order", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orderId: "ORD_1111111111111111111111", status: "canceled" },
    }));
    const customer = createClient(mockFetch).customer("token");

    const result = await customer.cancelOnetimeOrder({ orderId: "ORD_1111111111111111111111" });

    expect(result.status).toBe("canceled");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/onetime-order/cancel-order");
  });
});

describe("customer.reactivateSubscription", () => {
  it("should reactivate a subscription", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orderId: "ORD_0000000000000000000000", status: "active" },
    }));
    const customer = createClient(mockFetch).customer("token");

    const result = await customer.reactivateSubscription({ orderId: "ORD_0000000000000000000000" });

    expect(result.status).toBe("active");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-order/reactivate-order");
  });
});

describe("customer.createRefundTicket", () => {
  it("should create a refund ticket with all params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        ticket: {
          id: "TKT_0000000000000000000000",
          type: "refund",
          status: "pending",
          subjectId: "PAY_0000000000000000000000",
          submitterId: "customer@test.com",
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
    const customer = createClient(mockFetch).customer("token");

    const { ticket } = await customer.createRefundTicket({
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
          submitterId: "customer@test.com",
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
    const customer = createClient(mockFetch).customer("token");

    const { ticket } = await customer.createRefundTicket({
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
    const customer = createClient(mockFetch).customer("token");

    await expect(
      customer.createRefundTicket({
        paymentId: "PAY_0000000000000000000000",
        reason: "Product not as described",
        requestedAmount: { amount: "29.00", currency: "USD" },
        refundTicketMerchantExternalId: "x".repeat(129),
      }),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("customer.resubmitRefundTicket", () => {
  it("should resubmit a rejected ticket", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        ticket: {
          id: "TKT_0000000000000000000000",
          type: "refund",
          status: "pending",
          subjectId: "PAY_0000000000000000000000",
          submitterId: "customer@test.com",
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
    const customer = createClient(mockFetch).customer("token");

    const { ticket } = await customer.resubmitRefundTicket({
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

describe("customer.graphql.query", () => {
  it("returns the standard GraphQL envelope verbatim with Bearer auth", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { orders: [{ id: "ORD_0000000000000000000000", status: "completed" }] },
    }));
    const customer = createClient(mockFetch).customer("gql-token");

    const result = await customer.graphql.query<{ orders: Array<{ id: string; status: string }> }>({
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
    const customer = createClient(mockFetch).customer("gql-token");

    const result = await customer.graphql.query({ query: `query { orders { id } }` });

    expect(result.data?.orders).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.message).toBe("resolver crashed");
  });

  it("returns the envelope on HTTP 4xx instead of throwing", async () => {
    const mockFetch = vi.fn(async () => ({
      status: 401,
      json: () => Promise.resolve({ data: null, errors: [{ message: "Session expired", layer: "gateway" }] }),
    }));
    const customer = createClient(mockFetch as unknown as ReturnType<typeof vi.fn>).customer("expired");

    const result = await customer.graphql.query({ query: `query { orders { id } }` });

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.message).toBe("Session expired");
  });
});

describe("customer error handling", () => {
  it("should throw WaffoPancakeError on API error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      json: () =>
        Promise.resolve({
          data: null,
          errors: [{ message: "Session expired", layer: "gateway" }],
        }),
    });
    const customer = createClient(mockFetch as unknown as typeof vi.fn).customer("expired-token");

    await expect(customer.cancelSubscription({ orderId: "ORD_0000000000000000000000" })).rejects.toThrow(WaffoPancakeError);
  });
});
