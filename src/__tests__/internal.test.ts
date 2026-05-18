import { describe, expect, it } from "vitest";

import { WaffoPancakeError } from "../errors.js";
import { unwrapAction } from "../resources/internal.js";

import type { PostResult } from "../types.js";

const baseResult = (override: Partial<PostResult<{ store: { id: string } }>>): PostResult<{ store: { id: string } }> => ({
  status: 200,
  data: { store: { id: "STO_AbCdEfGhIjKlMnOpQrStUv" } },
  ...override,
});

describe("unwrapAction", () => {
  it("returns the data block when no errors and no warnings (no warnings field added)", () => {
    const result = unwrapAction(baseResult({ status: 200 }));

    expect(result.store.id).toBe("STO_AbCdEfGhIjKlMnOpQrStUv");
    expect("warnings" in result).toBe(false);
  });

  it("spreads warnings onto the result when present", () => {
    const warnings = [{ message: "deprecated field used", layer: "store" as const, aiHint: "Switch to client.webhooks.add" }];
    const result = unwrapAction(baseResult({ warnings }));

    expect(result.store.id).toBe("STO_AbCdEfGhIjKlMnOpQrStUv");
    expect(result.warnings).toEqual(warnings);
  });

  it("throws WaffoPancakeError with status and errors when errors[] is non-empty", () => {
    const errors = [{ message: "Store slug already exists", layer: "store" as const }];

    expect(() => unwrapAction(baseResult({ status: 409, data: null, errors }))).toThrow(WaffoPancakeError);

    try {
      unwrapAction(baseResult({ status: 409, data: null, errors }));
    } catch (e) {
      expect(e).toBeInstanceOf(WaffoPancakeError);
      expect((e as WaffoPancakeError).status).toBe(409);
      expect((e as WaffoPancakeError).errors).toEqual(errors);
    }
  });

  it("does not throw when errors is an empty array (treated as no errors)", () => {
    const result = unwrapAction(baseResult({ errors: [] }));

    expect(result.store.id).toBe("STO_AbCdEfGhIjKlMnOpQrStUv");
  });

  it("preserves all top-level data fields, not just the first key", () => {
    const r: PostResult<{ store: { id: string }; meta: { ts: string } }> = {
      status: 200,
      data: { store: { id: "STO_x" }, meta: { ts: "2026-01-01" } },
    };
    const result = unwrapAction(r);

    expect(result.store.id).toBe("STO_x");
    expect(result.meta.ts).toBe("2026-01-01");
  });
});
