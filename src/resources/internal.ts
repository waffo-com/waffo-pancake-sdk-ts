import { WaffoPancakeError } from "../errors.js";

import type { Notice, PostResult } from "../types.js";

/**
 * Resource-layer helper: unwrap a REST write-action envelope.
 *
 * - Throws {@link WaffoPancakeError} when `errors[]` is non-empty
 * - Otherwise returns the data block merged with `warnings` (if any), so callers
 *   can read structured `aiHint` notices alongside the typed result
 *
 * Use only for REST write endpoints where errors signal a failed action. Read
 * paths (e.g. GraphQL) should return the full envelope without unwrapping.
 *
 * @internal
 */
export function unwrapAction<T>(r: PostResult<T>): T & { warnings?: Notice[] } {
  if (r.errors?.length) {
    throw new WaffoPancakeError(r.status, r.errors);
  }
  return { ...(r.data as T), ...(r.warnings ? { warnings: r.warnings } : {}) };
}
