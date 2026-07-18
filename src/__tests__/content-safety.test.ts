import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";

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

describe("contentSafety.scanPrompt", () => {
  it("should scan with correct path and params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { action: "allow", reasonCode: "allowed", matchedCategories: [], requestId: "req-1", semanticStatus: "disabled" },
    }));
    const client = createClient(mockFetch);

    const verdict = await client.contentSafety.scanPrompt({ prompt: "a cat riding a bike" });

    expect(verdict.action).toBe("allow");
    expect(verdict.reasonCode).toBe("allowed");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/verification/scan-prompt");
    const body = JSON.parse(options.body as string);
    expect(body.prompt).toBe("a cat riding a bike");
  });

  it("should pass locale and semantic, and return block verdict", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        action: "block",
        reasonCode: "restricted_content",
        matchedCategories: ["adult_nsfw"],
        requestId: "req-2",
        semanticStatus: "shadow_scored",
      },
    }));
    const client = createClient(mockFetch);

    const verdict = await client.contentSafety.scanPrompt({ prompt: "bad prompt", locale: "en", semantic: "shadow" });

    expect(verdict.action).toBe("block");
    expect(verdict.matchedCategories).toContain("adult_nsfw");
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.locale).toBe("en");
    expect(body.semantic).toBe("shadow");
  });

  it("should throw when prompt is empty", async () => {
    const mockFetch = createMockFetch(() => ({ data: {} }));
    const client = createClient(mockFetch);

    await expect(client.contentSafety.scanPrompt({ prompt: "" })).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
