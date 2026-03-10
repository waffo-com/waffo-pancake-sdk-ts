import type { ApiError } from "./types.js";

/**
 * Error thrown when the API returns a non-success response.
 *
 * @example
 * try {
 *   await client.stores.create({ name: "My Store" });
 * } catch (err) {
 *   if (err instanceof WaffoPancakeError) {
 *     console.log(err.status);        // 400
 *     console.log(err.errors[0]);     // { message: "...", layer: "store" }
 *   }
 * }
 */
export class WaffoPancakeError extends Error {
  readonly status: number;
  readonly errors: ApiError[];

  constructor(status: number, errors: ApiError[]) {
    const rootCause = errors[0]?.message ?? "Unknown error";
    super(rootCause);
    this.name = "WaffoPancakeError";
    this.status = status;
    this.errors = errors;
  }
}
