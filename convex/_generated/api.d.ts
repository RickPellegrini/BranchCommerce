/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as administrativeDocuments from "../administrativeDocuments.js";
import type * as dedupeHelpers from "../dedupeHelpers.js";
import type * as finance from "../finance.js";
import type * as mercadolivre from "../mercadolivre.js";
import type * as mercadopago from "../mercadopago.js";
import type * as mpCron from "../mpCron.js";
import type * as productAnalysis from "../productAnalysis.js";
import type * as stock from "../stock.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  administrativeDocuments: typeof administrativeDocuments;
  dedupeHelpers: typeof dedupeHelpers;
  finance: typeof finance;
  mercadolivre: typeof mercadolivre;
  mercadopago: typeof mercadopago;
  mpCron: typeof mpCron;
  productAnalysis: typeof productAnalysis;
  stock: typeof stock;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
