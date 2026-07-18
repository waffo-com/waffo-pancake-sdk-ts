import { unwrapAction } from "./internal.js";
import { validateRequired } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type { ScanPromptParams, ScanResult } from "../types.js";

/** Content safety resource — scan user prompts before AIGC generation. */
export class ContentSafetyResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Scan a user's text prompt for content-safety compliance before AIGC
   * generation. Call this before invoking your image/video model and continue
   * only when `action` is `allow`.
   *
   * Stateless — the check never stores prompt text. If the safety service is
   * briefly unavailable, the verdict fails closed to `review` so an
   * unmoderated prompt is never let through.
   *
   * @param params - Scan parameters (prompt required; locale / semantic optional)
   * @returns Redacted scan verdict
   *
   * @example
   * const verdict = await client.contentSafety.scanPrompt({ prompt: "a cat riding a bike" });
   * if (verdict.action !== "allow") {
   *   // do not generate
   * }
   */
  async scanPrompt(params: ScanPromptParams): Promise<ScanResult> {
    validateRequired("prompt", params.prompt);
    return unwrapAction(await this.http.post<ScanResult>("/v1/actions/verification/scan-prompt", params));
  }
}
