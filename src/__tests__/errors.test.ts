import { describe, expect, it } from "vitest";

import { WaffoPancakeError } from "../errors.js";

describe("WaffoPancakeError", () => {
  it("should set status, errors, and message from first error", () => {
    const errors = [
      { message: "Store not found", layer: "store" as const },
      { message: "Internal error", layer: "gateway" as const },
    ];
    const err = new WaffoPancakeError(404, errors);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(WaffoPancakeError);
    expect(err.name).toBe("WaffoPancakeError");
    expect(err.status).toBe(404);
    expect(err.errors).toEqual(errors);
    expect(err.message).toBe("Store not found");
  });

  it("should default to 'Unknown error' when errors array is empty", () => {
    const err = new WaffoPancakeError(500, []);

    expect(err.message).toBe("Unknown error");
    expect(err.status).toBe(500);
    expect(err.errors).toEqual([]);
  });

  it("should be catchable as Error", () => {
    const err = new WaffoPancakeError(400, [{ message: "Bad request", layer: "user" }]);

    try {
      throw err;
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(WaffoPancakeError);
    }
  });
});
