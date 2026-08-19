import { currentUser } from "@clerk/nextjs/server"
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { DeletionRequestForm } from "@/components/account/deletion-request-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type DeletionRequestMetadata = { status?: "requested" | "cancelled" }

export default async function AccountPage() {
  const user = await currentUser()
  if (!user) redirect("/sign-in?redirect_url=/conta")

  const request = user.privateMetadata.accountDeletionRequest as DeletionRequestMetadata | undefined

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Voltar ao painel
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Conta e privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus dados e consulte como o Branch Commerce protege suas informações.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seus dados</CardTitle>
          <CardDescription>{user.primaryEmailAddress?.emailAddress}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/privacidade">
              Política de privacidade
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg">Excluir conta</CardTitle>
          <CardDescription>
            Solicite a exclusão da conta e dos dados vinculados ao Branch Commerce.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeletionRequestForm initialStatus={request?.status ?? null} />
        </CardContent>
      </Card>
    </main>
  )
}
