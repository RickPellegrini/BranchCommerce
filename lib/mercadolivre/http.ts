import { NextResponse } from "next/server"

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details,
    },
    { status },
  )
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status },
  )
}
