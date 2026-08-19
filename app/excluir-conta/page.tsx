import { currentUser } from "@clerk/nextjs/server"
import { LogIn, Trash2 } from "lucide-react"
import Link from "next/link"

import { DeletionRequestForm } from "@/components/account/deletion-request-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type DeletionRequestMetadata = { status?: "requested" | "cancelled" }

export default async function DeleteAccountPage() {
  const user = await currentUser()
  const request = user?.privateMetadata.accountDeletionRequest as
    | DeletionRequestMetadata
    | undefined

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
      <Card className="w-full border-destructive/25">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Trash2 className="size-5" />
          </div>
          <CardTitle>Exclusão de conta</CardTitle>
          <CardDescription>
            Esta página permite solicitar a exclusão da conta Branch Commerce e dos dados
            associados, mesmo que você já tenha desinstalado o aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <DeletionRequestForm initialStatus={request?.status ?? null} />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Entre com a conta que deseja excluir para confirmarmos sua identidade.
              </p>
              <Button asChild className="w-full">
                <Link href="/sign-in?redirect_url=/excluir-conta">
                  <LogIn className="size-4" />
                  Entrar para solicitar exclusão
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
