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
   *   storeId: "sto_xxx",
   *   email: "member@example.com",
   *   role: "admin",
   * });
   */
  async add(params: AddMerchantParams): Promise<AddMerchantResult> {
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
   *   storeId: "sto_xxx",
   *   merchantId: "mer_xxx",
   * });
   */
  async remove(params: RemoveMerchantParams): Promise<RemoveMerchantResult> {
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
   *   storeId: "sto_xxx",
   *   merchantId: "mer_xxx",
   *   role: "member",
   * });
   */
  async updateRole(params: UpdateRoleParams): Promise<UpdateRoleResult> {
    return this.http.post<UpdateRoleResult>("/v1/actions/store-merchant/update-role", params);
  }
}
