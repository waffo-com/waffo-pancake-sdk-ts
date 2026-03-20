import type { HttpClient } from "../http-client.js";
import type {
  CreateSubscriptionProductGroupParams,
  DeleteSubscriptionProductGroupParams,
  PublishSubscriptionProductGroupParams,
  SubscriptionProductGroup,
  UpdateSubscriptionProductGroupParams,
} from "../types.js";

/** Subscription product group management resource (shared trial, plan switching). */
export class SubscriptionProductGroupsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a subscription product group for shared-trial or plan switching.
   *
   * @param params - Group creation parameters
   * @returns Created group entity
   *
   * @example
   * const { group } = await client.subscriptionProductGroups.create({
   *   storeId: "store_xxx",
   *   name: "Pro Plans",
   *   rules: { sharedTrial: true },
   *   productIds: ["prod_aaa", "prod_bbb"],
   * });
   */
  async create(params: CreateSubscriptionProductGroupParams): Promise<{ group: SubscriptionProductGroup }> {
    return this.http.post<{ group: SubscriptionProductGroup }>("/v1/actions/subscription-product-group/create-group", params);
  }

  /**
   * Update a subscription product group. `productIds` is a full replacement.
   *
   * @param params - Group update parameters
   * @returns Updated group entity
   *
   * @example
   * const { group } = await client.subscriptionProductGroups.update({
   *   id: "group_xxx",
   *   productIds: ["prod_aaa", "prod_bbb", "prod_ccc"],
   * });
   */
  async update(params: UpdateSubscriptionProductGroupParams): Promise<{ group: SubscriptionProductGroup }> {
    return this.http.post<{ group: SubscriptionProductGroup }>("/v1/actions/subscription-product-group/update-group", params);
  }

  /**
   * Hard-delete a subscription product group.
   *
   * @param params - Group to delete
   * @returns Deleted group entity
   *
   * @example
   * const { group } = await client.subscriptionProductGroups.delete({ id: "group_xxx" });
   */
  async delete(params: DeleteSubscriptionProductGroupParams): Promise<{ group: SubscriptionProductGroup }> {
    return this.http.post<{ group: SubscriptionProductGroup }>("/v1/actions/subscription-product-group/delete-group", params);
  }

  /**
   * Publish a test-environment group to production (upsert).
   *
   * @param params - Group to publish
   * @returns Published group entity
   *
   * @example
   * const { group } = await client.subscriptionProductGroups.publish({ id: "group_xxx" });
   */
  async publish(params: PublishSubscriptionProductGroupParams): Promise<{ group: SubscriptionProductGroup }> {
    return this.http.post<{ group: SubscriptionProductGroup }>("/v1/actions/subscription-product-group/publish-group", params);
  }
}
