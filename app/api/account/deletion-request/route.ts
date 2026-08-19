import { auth, clerkClient } from "@clerk/nextjs/server"

type DeletionRequest = {
  status: "requested" | "cancelled"
  requestedAt: string
  cancelledAt?: string
  source: "account_page"
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: "Não autenticado." }, { status: 401 })

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const deletionRequest: DeletionRequest = {
    status: "requested",
    requestedAt: new Date().toISOString(),
    source: "account_page",
  }

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      ...user.privateMetadata,
      accountDeletionRequest: deletionRequest,
    },
  })

  return Response.json({ ok: true, deletionRequest })
}

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: "Não autenticado." }, { status: 401 })

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const previous = user.privateMetadata.accountDeletionRequest as DeletionRequest | undefined
  const deletionRequest: DeletionRequest = {
    status: "cancelled",
    requestedAt: previous?.requestedAt ?? new Date().toISOString(),
    cancelledAt: new Date().toISOString(),
    source: "account_page",
  }

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      ...user.privateMetadata,
      accountDeletionRequest: deletionRequest,
    },
  })

  return Response.json({ ok: true, deletionRequest })
}
