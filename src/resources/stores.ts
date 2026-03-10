import type { HttpClient } from "../http-client.js";
import type {
  CreateStoreParams,
  DeleteStoreParams,
  Store,
  UpdateStoreParams,
} from "../types.js";

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
    return this.http.post("/v1/actions/store/create-store", params);
  }

  /**
   * Update an existing store's settings.
   *
   * @param params - Fields to update (only provided fields are changed)
   * @returns Updated store entity
   *
   * @example
   * const { store } = await client.stores.update({
   *   id: "store_xxx",
   *   name: "Updated Name",
   *   supportEmail: "help@example.com",
   * });
   */
  async update(params: UpdateStoreParams): Promise<{ store: Store }> {
    return this.http.post("/v1/actions/store/update-store", params);
  }

  /**
   * Soft-delete a store. Only the owner can delete.
   *
   * @param params - Store to delete
   * @returns Deleted store entity (with `deletedAt` set)
   *
   * @example
   * const { store } = await client.stores.delete({ id: "store_xxx" });
   */
  async delete(params: DeleteStoreParams): Promise<{ store: Store }> {
    return this.http.post("/v1/actions/store/delete-store", params);
  }
}
