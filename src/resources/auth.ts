import { WaffoPancakeError } from "../errors.js";
import { unwrapAction } from "./internal.js";
import { validateRequired, validateShortId } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type {
  CreateCustomerPortalLinkParams,
  CustomerPortalLink,
  IssueSessionTokenParams,
  Notice,
  RequestOptions,
  SessionToken,
} from "../types.js";

/** Wire shape of `issue-session-token` when called with `purpose: "portal"`. */
interface PortalSessionToken extends SessionToken {
  portalUrl?: string;
}

/** Authentication resource — issue session tokens and customer portal links. */
export class AuthResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Issue a session token for a customer.
   *
   * @param params - Token issuance parameters
   * @returns Issued session token with expiration
   *
   * @example
   * // By store ID
   * const { token, expiresAt } = await client.auth.issueSessionToken({
   *   storeId: "STO_xxx",
   *   buyerIdentity: "customer@example.com",
   * });
   *
   * @example
   * // By product ID (store derived automatically)
   * const { token, expiresAt } = await client.auth.issueSessionToken({
   *   productId: "PROD_xxx",
   *   buyerIdentity: "customer@example.com",
   * });
   */
  async issueSessionToken(params: IssueSessionTokenParams, options?: RequestOptions): Promise<SessionToken & { warnings?: Notice[] }> {
    if (!params.storeId && !params.productId) {
      throw new WaffoPancakeError(400, [{ message: "Missing required field: provide storeId or productId", layer: "sdk" }]);
    }
    if (params.storeId) {
      validateShortId("storeId", params.storeId, "STO");
    }
    if (params.productId) {
      validateShortId("productId", params.productId, "PROD");
    }
    validateRequired("buyerIdentity", params.buyerIdentity);
    return unwrapAction(await this.http.post<SessionToken>("/v1/actions/auth/issue-session-token", params, options));
  }

  /**
   * Create a customer portal link that signs the customer straight into your
   * store's Pancake customer portal — no email verification step.
   *
   * Behavior:
   * - Calls `issue-session-token` with `purpose: "portal"`; the platform issues a
   *   portal-scoped session token for (`storeId`, `buyerIdentity`) and returns the
   *   portal page URL
   * - Appends the token to that URL as a fragment (`#token=...`), the same way
   *   `checkout.authenticated.create()` builds `checkoutUrl`. Fragments are not
   *   sent in HTTP requests or `Referer` headers
   * - The portal environment is the environment of the API Key this client signs
   *   with (test key → test portal, prod key → prod portal); there is no
   *   environment parameter
   *
   * Side effects:
   * - One signed API request; issues a new session on every call
   *
   * Boundary conditions:
   * - `storeId` must be a Store Short ID (`STO_xxx`); `buyerIdentity` must be non-empty.
   *   Both are checked before any request is sent (`WaffoPancakeError`, 400, `layer: "sdk"`)
   * - Throws `WaffoPancakeError` (`layer: "sdk"`) when the platform response has no
   *   `portalUrl` (e.g. an API that predates portal links) or no `token`
   *
   * Security: `buyerIdentity` and `storeId` must come from your backend's own
   * authenticated session for the signed-in customer, never from request
   * parameters the browser controls. Call this server-side, redirect right away,
   * and do not log or cache the returned URL — it carries a bearer token.
   *
   * @param params - Store and customer identity from your authenticated session
   * @param options - Per-request options (e.g. `idempotencyKey`)
   * @returns Portal URL with `#token=...` appended, and the token expiry
   * @throws {WaffoPancakeError} On invalid input, API errors, or a response without `portalUrl` or `token`
   *
   * @example
   * // In your authenticated route handler
   * const user = await requireSignedInUser(request); // your own session check
   * const { portalUrl } = await client.auth.createCustomerPortalLink({
   *   storeId: "STO_xxx",
   *   buyerIdentity: user.id,
   * });
   * return new Response(null, {
   *   status: 302,
   *   headers: { Location: portalUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
   * });
   * // portalUrl => "https://pancake.waffo.ai/consumer/portal/store/STO_xxx#token=eyJ..."
   */
  async createCustomerPortalLink(
    params: CreateCustomerPortalLinkParams,
    options?: RequestOptions,
  ): Promise<CustomerPortalLink & { warnings?: Notice[] }> {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("buyerIdentity", params.buyerIdentity);

    const result = await this.http.post<PortalSessionToken>(
      "/v1/actions/auth/issue-session-token",
      { storeId: params.storeId, buyerIdentity: params.buyerIdentity, purpose: "portal" },
      options,
    );
    const data = unwrapAction(result);
    if (typeof data.portalUrl !== "string" || data.portalUrl === "") {
      throw new WaffoPancakeError(result.status, [
        { message: 'Missing portalUrl in issue-session-token response for purpose "portal"', layer: "sdk" },
      ]);
    }
    if (typeof data.token !== "string" || data.token === "") {
      throw new WaffoPancakeError(result.status, [
        { message: 'Missing token in issue-session-token response for purpose "portal"', layer: "sdk" },
      ]);
    }

    return {
      portalUrl: `${data.portalUrl}#token=${data.token}`,
      expiresAt: data.expiresAt,
      ...(data.warnings ? { warnings: data.warnings } : {}),
    };
  }
}
