const IOS_BUNDLE_ID = "com.branchcommercehub.app"

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim()

  if (!teamId) {
    return Response.json(
      { error: "APPLE_TEAM_ID nao configurado." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    )
  }

  return Response.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${teamId}.${IOS_BUNDLE_ID}`,
            paths: ["/*"],
          },
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  )
}
