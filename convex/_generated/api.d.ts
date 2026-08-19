/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as administrativeDocuments from "../administrativeDocuments.js";
import type * as branchNotifyDb from "../branchNotifyDb.js";
import type * as crons from "../crons.js";
import type * as dedupeHelpers from "../dedupeHelpers.js";
import type * as finance from "../finance.js";
import type * as mercadolivre from "../mercadolivre.js";
import type * as mercadopago from "../mercadopago.js";
import type * as monitor from "../monitor.js";
import type * as monitorLogic from "../monitorLogic.js";
import type * as monitorRun from "../monitorRun.js";
import type * as mpCron from "../mpCron.js";
import type * as notifications from "../notifications.js";
import type * as pix from "../pix.js";
import type * as productAnalysis from "../productAnalysis.js";
import type * as products from "../products.js";
import type * as settings from "../settings.js";
import type * as stock from "../stock.js";
import type * as storeCart from "../storeCart.js";
import type * as storeCatalog from "../storeCatalog.js";
import type * as storeCheckout from "../storeCheckout.js";
import type * as storeOrders from "../storeOrders.js";
import type * as storeReservations from "../storeReservations.js";
import type * as telegram from "../telegram.js";
import type * as vtex from "../vtex.js";
import type * as vtexActions from "../vtexActions.js";
import type * as vtexFetch from "../vtexFetch.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  administrativeDocuments: typeof administrativeDocuments;
  branchNotifyDb: typeof branchNotifyDb;
  crons: typeof crons;
  dedupeHelpers: typeof dedupeHelpers;
  finance: typeof finance;
  mercadolivre: typeof mercadolivre;
  mercadopago: typeof mercadopago;
  monitor: typeof monitor;
  monitorLogic: typeof monitorLogic;
  monitorRun: typeof monitorRun;
  mpCron: typeof mpCron;
  notifications: typeof notifications;
  pix: typeof pix;
  productAnalysis: typeof productAnalysis;
  products: typeof products;
  settings: typeof settings;
  stock: typeof stock;
  storeCart: typeof storeCart;
  storeCatalog: typeof storeCatalog;
  storeCheckout: typeof storeCheckout;
  storeOrders: typeof storeOrders;
  storeReservations: typeof storeReservations;
  telegram: typeof telegram;
  vtex: typeof vtex;
  vtexActions: typeof vtexActions;
  vtexFetch: typeof vtexFetch;
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
