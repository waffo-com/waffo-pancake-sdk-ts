import { validateRequired, validateShortId } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type { CreateStoreParams, DeleteStoreParams, Store, UpdateStoreParams } from "../types.js";

/** Store management resource — create, update, and delete stores. */
export class StoresResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new store. Slug is auto-generated from the name.
   *
   * @param params - Store creation parameters
   * @returns Created store entity
   *
   * @example
   * const { store } = await client.stores.create({ name: "My Store" });
   */
  async create(params: CreateStoreParams): Promise<{ store: Store }> {
    validateRequired("name", params.name);
    return this.http.post<{ store: Store }>("/v1/actions/store/create-store", params);
  }

  /**
   * Update an existing store's settings.
   *
   * Settings objects (`webhookSettings`, `notificationSettings`, `checkoutSettings`)
   * support partial updates: omitted sub-fields keep existing values, `null` clears
   * a field. Pass the entire settings object as `null` to clear all fields.
   *
   * @param params - Fields to update (only provided fields are changed)
   * @returns Updated store entity
   *
   * @example
   * // Update name
   * const { store } = await client.stores.update({
   *   id: "STO_xxx",
   *   name: "Updated Name",
   * });
   *
   * @example
   * // Clear test webhook URL while keeping other webhook settings
   * const { store } = await client.stores.update({
   *   id: "STO_xxx",
   *   webhookSettings: { testWebhookUrl: null },
   * });
   */
  async update(params: UpdateStoreParams): Promise<{ store: Store }> {
    validateShortId("id", params.id, "STO");
    return this.http.post<{ store: Store }>("/v1/actions/store/update-store", params);
  }

  /**
   * Soft-delete a store. Only the owner can delete.
   *
   * @param params - Store to delete
   * @returns Deleted store entity (with `deletedAt` set)
   *
   * @example
   * const { store } = await client.stores.delete({ id: "STO_xxx" });
   */
  async delete(params: DeleteStoreParams): Promise<{ store: Store }> {
    validateShortId("id", params.id, "STO");
    return this.http.post<{ store: Store }>("/v1/actions/store/delete-store", params);
  }
}
