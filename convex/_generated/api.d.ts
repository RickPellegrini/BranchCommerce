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
import type * as monitor from "../monitor.js";
import type * as monitorRun from "../monitorRun.js";
import type * as mpCron from "../mpCron.js";
import type * as notifications from "../notifications.js";
import type * as productAnalysis from "../productAnalysis.js";
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
  crons: typeof crons;
  administrativeDocuments: typeof administrativeDocuments;
  dedupeHelpers: typeof dedupeHelpers;
  finance: typeof finance;
  mercadolivre: typeof mercadolivre;
  mercadopago: typeof mercadopago;
  monitor: typeof monitor;
  monitorRun: typeof monitorRun;
  mpCron: typeof mpCron;
  notifications: typeof notifications;
  productAnalysis: typeof productAnalysis;
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
