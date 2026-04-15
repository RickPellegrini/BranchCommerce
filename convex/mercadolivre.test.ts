/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

const connectionArgs = {
  appUserId: "app-user-1",
  mlUserId: "ml-user-1",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresIn: 21600,
  expiresAt: Date.now() + 21600 * 1000,
}

describe("mercadolivre", () => {
  // ── upsertConnection ──────────────────────────────────────────────

  describe("upsertConnection", () => {
    it("inserts a new connection", async () => {
      const t = convexTest(schema, modules)
      const id = await t.mutation(api.mercadolivre.upsertConnection, connectionArgs)
      expect(id).toBeTruthy()
    })

    it("updates existing connection for same appUserId", async () => {
      const t = convexTest(schema, modules)
      const id1 = await t.mutation(api.mercadolivre.upsertConnection, connectionArgs)
      const id2 = await t.mutation(api.mercadolivre.upsertConnection, {
        ...connectionArgs,
        accessToken: "new-token",
        refreshToken: "new-refresh",
      })
      expect(id2).toBe(id1)
      const conn = await t.query(api.mercadolivre.getConnectionByAppUser, {
        appUserId: "app-user-1",
      })
      expect(conn!.accessToken).toBe("new-token")
    })
  })

  // ── getConnectionByAppUser ────────────────────────────────────────

  describe("getConnectionByAppUser", () => {
    it("returns connection for existing app user", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.mercadolivre.upsertConnection, connectionArgs)
      const conn = await t.query(api.mercadolivre.getConnectionByAppUser, {
        appUserId: "app-user-1",
      })
      expect(conn).toBeTruthy()
      expect(conn!.mlUserId).toBe("ml-user-1")
    })

    it("returns null for non-existing user", async () => {
      const t = convexTest(schema, modules)
      const conn = await t.query(api.mercadolivre.getConnectionByAppUser, {
        appUserId: "non-existent",
      })
      expect(conn).toBeNull()
    })
  })

  // ── getConnectionByMlUser ─────────────────────────────────────────

  describe("getConnectionByMlUser", () => {
    it("returns connection for existing ML user", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.mercadolivre.upsertConnection, connectionArgs)
      const conn = await t.query(api.mercadolivre.getConnectionByMlUser, {
        mlUserId: "ml-user-1",
      })
      expect(conn).toBeTruthy()
      expect(conn!.appUserId).toBe("app-user-1")
    })

    it("returns null for non-existing ML user", async () => {
      const t = convexTest(schema, modules)
      const conn = await t.query(api.mercadolivre.getConnectionByMlUser, {
        mlUserId: "unknown",
      })
      expect(conn).toBeNull()
    })
  })

  // ── getAnyConnection ──────────────────────────────────────────────

  describe("getAnyConnection", () => {
    it("returns first connection", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.mercadolivre.upsertConnection, connectionArgs)
      const conn = await t.query(api.mercadolivre.getAnyConnection, {})
      expect(conn).toBeTruthy()
    })

    it("returns null when no connections", async () => {
      const t = convexTest(schema, modules)
      const conn = await t.query(api.mercadolivre.getAnyConnection, {})
      expect(conn).toBeNull()
    })
  })

  // ── updateTokens ──────────────────────────────────────────────────

  describe("updateTokens", () => {
    it("updates tokens for existing connection", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.mercadolivre.upsertConnection, connectionArgs)
      await t.mutation(api.mercadolivre.updateTokens, {
        appUserId: "app-user-1",
        accessToken: "refreshed-access",
        refreshToken: "refreshed-refresh",
        expiresIn: 21600,
        expiresAt: Date.now() + 21600 * 1000,
      })
      const conn = await t.query(api.mercadolivre.getConnectionByAppUser, {
        appUserId: "app-user-1",
      })
      expect(conn!.accessToken).toBe("refreshed-access")
      expect(conn!.refreshToken).toBe("refreshed-refresh")
    })

    it("throws when no connection exists", async () => {
      const t = convexTest(schema, modules)
      await expect(
        t.mutation(api.mercadolivre.updateTokens, {
          appUserId: "non-existent",
          accessToken: "tok",
          refreshToken: "ref",
          expiresIn: 100,
          expiresAt: Date.now() + 100000,
        }),
      ).rejects.toThrow("nao conectada")
    })
  })

  // ── disconnectConnection ──────────────────────────────────────────

  describe("disconnectConnection", () => {
    it("removes existing connection", async () => {
      const t = convexTest(schema, modules)
      await t.mutation(api.mercadolivre.upsertConnection, connectionArgs)
      const result = await t.mutation(api.mercadolivre.disconnectConnection, {
        appUserId: "app-user-1",
      })
      expect(result.removed).toBe(true)
      const conn = await t.query(api.mercadolivre.getConnectionByAppUser, {
        appUserId: "app-user-1",
      })
      expect(conn).toBeNull()
    })

    it("returns removed:false when no connection", async () => {
      const t = convexTest(schema, modules)
      const result = await t.mutation(api.mercadolivre.disconnectConnection, {
        appUserId: "non-existent",
      })
      expect(result.removed).toBe(false)
    })
  })
})
