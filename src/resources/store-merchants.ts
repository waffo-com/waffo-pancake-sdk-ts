import { validateEnum, validateRequired, validateShortId } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type {
  AddMerchantParams,
  AddMerchantResult,
  RemoveMerchantParams,
  RemoveMerchantResult,
  UpdateRoleParams,
  UpdateRoleResult,
} from "../types.js";

/** Store merchant management resource (coming soon — endpoints return 501). */
export class StoreMerchantsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Add a merchant to a store.
   *
   * @param params - Merchant addition parameters
   * @returns Added merchant details
   *
   * @example
   * const result = await client.storeMerchants.add({
   *   storeId: "STO_xxx",
   *   email: "member@example.com",
   *   role: "admin",
   * });
   */
  async add(params: AddMerchantParams): Promise<AddMerchantResult> {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("email", params.email);
    validateEnum("role", params.role, ["admin", "member"]);
    return this.http.post<AddMerchantResult>("/v1/actions/store-merchant/add-merchant", params);
  }

  /**
   * Remove a merchant from a store.
   *
   * @param params - Merchant removal parameters
   * @returns Removal confirmation
   *
   * @example
   * const result = await client.storeMerchants.remove({
   *   storeId: "STO_xxx",
   *   merchantId: "MER_xxx",
   * });
   */
  async remove(params: RemoveMerchantParams): Promise<RemoveMerchantResult> {
    validateShortId("storeId", params.storeId, "STO");
    validateShortId("merchantId", params.merchantId, "MER");
    return this.http.post<RemoveMerchantResult>("/v1/actions/store-merchant/remove-merchant", params);
  }

  /**
   * Update a merchant's role in a store.
   *
   * @param params - Role update parameters
   * @returns Updated role details
   *
   * @example
   * const result = await client.storeMerchants.updateRole({
   *   storeId: "STO_xxx",
   *   merchantId: "MER_xxx",
   *   role: "member",
   * });
   */
  async updateRole(params: UpdateRoleParams): Promise<UpdateRoleResult> {
    validateShortId("storeId", params.storeId, "STO");
    validateShortId("merchantId", params.merchantId, "MER");
    validateEnum("role", params.role, ["admin", "member"]);
    return this.http.post<UpdateRoleResult>("/v1/actions/store-merchant/update-role", params);
  }
}
