const ANDROID_APP_ID = "com.branchcommercehub.app"
const ANDROID_CERTIFICATE_SHA256 =
  "14:0B:0C:4C:35:3D:37:21:D3:C6:A8:8C:87:E0:06:FF:12:27:06:9B:EE:CC:B8:79:D7:B2:5B:53:73:5F:7C:8B"

export function GET() {
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_APP_ID,
        sha256_cert_fingerprints: [ANDROID_CERTIFICATE_SHA256],
      },
    },
  ])
}
