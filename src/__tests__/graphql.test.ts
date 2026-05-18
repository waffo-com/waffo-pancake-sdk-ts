import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";

const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function mockGraphQL(status: number, body: object) {
  return vi.fn(async () => ({
    status,
    json: () => Promise.resolve(body),
  }));
}

function makeClient(mockFetch: ReturnType<typeof mockGraphQL>) {
  return new WaffoPancake({
    merchantId: "MER_0000000000000000000000",
    privateKey: TEST_PRIVATE_KEY,
    baseUrl: "https://api.test.com",
    fetch: mockFetch as unknown as typeof fetch,
  });
}

describe("client.graphql.query — request headers", () => {
  it("does NOT attach X-Idempotency-Key (queries must hit live DB, not gateway cache)", async () => {
    const mockFetch = mockGraphQL(200, { data: { stores: [] } });
    const client = makeClient(mockFetch);

    await client.graphql.query({ query: `query { stores { id } }` });

    const headers = mockFetch.mock.calls[0]?.[1].headers as Record<string, string>;
    expect(headers["X-Idempotency-Key"]).toBeUndefined();
    expect(headers["X-Signature"]).toBeDefined();
    expect(headers["X-Merchant-Id"]).toBe("MER_0000000000000000000000");
  });
});

describe("client.graphql.query — wire shapes", () => {
  // Shape #1: standard success
  it("returns data verbatim from single-wrap envelope", async () => {
    const mockFetch = mockGraphQL(200, {
      data: { stores: [{ id: "STO_AbCdEfGhIjKlMnOpQrStUv", name: "Acme" }] },
    });
    const client = makeClient(mockFetch);

    const result = await client.graphql.query<{ stores: Array<{ id: string; name: string }> }>({
      query: `query { stores { id name } }`,
    });

    expect(result.data?.stores).toHaveLength(1);
    expect(result.data?.stores[0]?.id).toBe("STO_AbCdEfGhIjKlMnOpQrStUv");
    expect(result.errors).toBeUndefined();
    expect(result.warnings).toBeUndefined();
  });

  // Shape #2: success + warnings (cost over threshold)
  it("surfaces warnings alongside data", async () => {
    const mockFetch = mockGraphQL(200, {
      data: { stores: [] },
      warnings: [
        {
          message: "Query estimated cost 25000 exceeds warning threshold 20000",
          layer: "graphql",
          aiHint: "REDUCE_QUERY_SIZE: halve all list `limit` arguments",
        },
      ],
    });
    const client = makeClient(mockFetch);

    const result = await client.graphql.query({ query: `query { stores { id } }` });

    expect(result.data?.stores).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0]?.aiHint).toContain("REDUCE_QUERY_SIZE");
  });

  // Shape #3: partial success (data + errors co-exist)
  it("preserves partial-success envelope (data + errors)", async () => {
    const mockFetch = mockGraphQL(200, {
      data: { stores: [{ id: "STO_AbCdEfGhIjKlMnOpQrStUv", name: "Acme" }], analytics: null },
      errors: [{ message: "analytics resolver failed", path: ["analytics"] }],
    });
    const client = makeClient(mockFetch);

    const result = await client.graphql.query<{ stores: Array<{ id: string }>; analytics: null }>({
      query: `query { stores { id } analytics { dau } }`,
    });

    expect(result.data?.stores).toHaveLength(1);
    expect(result.data?.analytics).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.path).toEqual(["analytics"]);
  });

  // Shape #4: schema validation error (status 200 by GraphQL convention)
  it("does not throw on status-200 schema validation error", async () => {
    const mockFetch = mockGraphQL(200, {
      data: null,
      errors: [{ message: "Cannot query field 'nonexistent' on type 'Query'", layer: "graphql" }],
    });
    const client = makeClient(mockFetch);

    const result = await client.graphql.query({ query: `query { nonexistent }` });

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.message).toContain("Cannot query field");
  });

  // Shape #5: gateway / pre-check error with non-2xx status
  it("returns the envelope on HTTP 4xx instead of throwing", async () => {
    const mockFetch = mockGraphQL(401, {
      data: null,
      errors: [{ message: "Authentication required", layer: "gateway" }],
    });
    const client = makeClient(mockFetch);

    const result = await client.graphql.query({ query: `query { stores { id } }` });

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.layer).toBe("gateway");
  });

  it("returns the envelope on HTTP 5xx instead of throwing", async () => {
    const mockFetch = mockGraphQL(500, {
      data: null,
      errors: [{ message: "Request processing failed", layer: "graphql" }],
    });
    const client = makeClient(mockFetch);

    const result = await client.graphql.query({ query: `query { stores { id } }` });

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.layer).toBe("graphql");
  });

  // Transport failure path: non-JSON body must throw
  it("throws WaffoPancakeError when body is not JSON", async () => {
    const mockFetch = vi.fn(async () => ({
      status: 502,
      json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
    }));
    const client = makeClient(mockFetch as unknown as ReturnType<typeof mockGraphQL>);

    await expect(client.graphql.query({ query: `query { stores { id } }` })).rejects.toThrow(WaffoPancakeError);
  });
});
