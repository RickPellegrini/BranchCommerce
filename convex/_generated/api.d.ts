/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as dedupeHelpers from "../dedupeHelpers.js";
import type * as finance from "../finance.js";
import type * as mercadolivre from "../mercadolivre.js";
import type * as monitor from "../monitor.js";
import type * as monitorRun from "../monitorRun.js";
import type * as notifications from "../notifications.js";
import type * as products from "../products.js";
import type * as settings from "../settings.js";
import type * as stock from "../stock.js";
import type * as telegram from "../telegram.js";
import type * as vtexActions from "../vtexActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  dedupeHelpers: typeof dedupeHelpers;
  finance: typeof finance;
  mercadolivre: typeof mercadolivre;
  monitor: typeof monitor;
  monitorRun: typeof monitorRun;
  notifications: typeof notifications;
  products: typeof products;
  settings: typeof settings;
  stock: typeof stock;
  telegram: typeof telegram;
  vtexActions: typeof vtexActions;
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
