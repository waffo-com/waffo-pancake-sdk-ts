/**
 * Client-side input validation.
 *
 * These checks catch obviously invalid inputs before making a network request.
 * They do NOT validate data existence (e.g., whether a store/product actually exists).
 *
 * All validation errors throw `WaffoPancakeError` with `status: 400` and `layer: "sdk"`,
 * so developers can catch them uniformly with API errors.
 *
 * Not exported publicly — used internally by resource classes.
 */

import { WaffoPancakeError } from "./errors.js";

const SHORT_ID_REGEX = /^[A-Z]{2,4}_[A-Za-z0-9]+$/;
const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const AMOUNT_STRING_REGEX = /^\d+(\.\d+)?$/;

const SHORT_ID_LABELS: Record<string, string> = {
  STO: "Store",
  PROD: "Product",
  ORD: "Order",
  PAY: "Payment",
  REF: "Refund",
  TKT: "Ticket",
  MER: "Merchant",
};

function fail(message: string): never {
  throw new WaffoPancakeError(400, [{ message, layer: "sdk" }]);
}

/**
 * Validate that a required field is present and non-empty.
 */
export function validateRequired(field: string, value: unknown): void {
  if (value === undefined || value === null) {
    fail(`Missing required field: ${field}`);
  }
  if (typeof value === "string" && value.trim() === "") {
    fail(`${field} cannot be empty`);
  }
}

/**
 * Validate Short ID format (`{PREFIX}_{base62}`).
 */
export function validateShortId(field: string, value: string, prefix: string): void {
  validateRequired(field, value);
  const label = SHORT_ID_LABELS[prefix] ?? prefix;
  if (!SHORT_ID_REGEX.test(value)) {
    fail(`Invalid ${field}: expected ${label} Short ID format (${prefix}_xxx), got "${value}"`);
  }
  if (!value.startsWith(`${prefix}_`)) {
    fail(`Invalid ${field}: expected ${prefix}_ prefix (${label}), got "${value.split("_")[0]}_"`);
  }
}

/**
 * Validate ISO 4217 currency code format (3 uppercase letters).
 */
export function validateCurrencyCode(field: string, value: string): void {
  validateRequired(field, value);
  if (!CURRENCY_CODE_REGEX.test(value)) {
    fail(`Invalid ${field}: expected 3-letter ISO 4217 currency code (e.g., "USD"), got "${value}"`);
  }
}

/**
 * Validate that amount is a valid numeric string in display format.
 */
export function validateAmountString(field: string, value: string): void {
  validateRequired(field, value);
  if (!AMOUNT_STRING_REGEX.test(value)) {
    fail(`Invalid ${field}: expected numeric string in display format (e.g., "9.99", "1000"), got "${value}"`);
  }
}

/**
 * Validate that a value is one of the allowed enum values.
 */
export function validateEnum(field: string, value: string, allowed: string[]): void {
  validateRequired(field, value);
  if (!allowed.includes(value)) {
    fail(`Invalid ${field}: expected one of [${allowed.join(", ")}], got "${value}"`);
  }
}

/**
 * Validate that a value is a positive integer.
 */
export function validatePositiveInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`Invalid ${field}: expected positive integer, got ${value}`);
  }
}

/**
 * Validate ISO 3166-1 alpha-2 country code (2 uppercase letters).
 */
export function validateCountryCode(field: string, value: string): void {
  validateRequired(field, value);
  if (!COUNTRY_CODE_REGEX.test(value)) {
    fail(`Invalid ${field}: expected 2-letter ISO 3166-1 country code (e.g., "US"), got "${value}"`);
  }
}

/**
 * Validate Prices object — each currency key and price amount.
 */
export function validatePrices(field: string, prices: Record<string, { amount: string; taxCategory: string }>): void {
  validateRequired(field, prices);
  const entries = Object.entries(prices);
  if (entries.length === 0) {
    fail(`${field} must contain at least one currency`);
  }
  for (const [currency, info] of entries) {
    validateCurrencyCode(`${field}.${currency} (key)`, currency);
    validateAmountString(`${field}.${currency}.amount`, info.amount);
    validateRequired(`${field}.${currency}.taxCategory`, info.taxCategory);
  }
}

/**
 * Validate BillingDetail fields (when present).
 */
export function validateBillingDetail(detail: { country: string; isBusiness: boolean }): void {
  validateCountryCode("billingDetail.country", detail.country);
  if (typeof detail.isBusiness !== "boolean") {
    fail(`Invalid billingDetail.isBusiness: expected boolean, got ${typeof detail.isBusiness}`);
  }
}

/**
 * Validate checkout session common fields.
 */
export function validateCheckoutCommon(params: {
  productId: string;
  currency: string;
  priceSnapshot?: { amount: string; taxCategory: string };
  billingDetail?: { country: string; isBusiness: boolean };
  expiresInSeconds?: number;
}): void {
  validateShortId("productId", params.productId, "PROD");
  validateCurrencyCode("currency", params.currency);
  if (params.priceSnapshot) {
    validateAmountString("priceSnapshot.amount", params.priceSnapshot.amount);
    validateRequired("priceSnapshot.taxCategory", params.priceSnapshot.taxCategory);
  }
  if (params.billingDetail) {
    validateBillingDetail(params.billingDetail);
  }
  if (params.expiresInSeconds !== undefined) {
    validatePositiveInteger("expiresInSeconds", params.expiresInSeconds);
  }
}
