import { SignOutButton } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function UnauthorizedPage() {
  const user = await currentUser()
  const primaryEmail = user?.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  )?.emailAddress

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center bg-muted/20 p-6">
      <Card className="w-full border-destructive/20">
        <CardHeader>
          <CardTitle>Acesso negado</CardTitle>
          <CardDescription>
            Sua conta esta autenticada, mas nao esta autorizada como admin da plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-none border bg-background p-3">
            <p className="font-medium text-foreground">Conta atual</p>
            <p>{primaryEmail ?? "Email principal nao encontrado no Clerk."}</p>
          </div>
          <p>
            Para liberar acesso, adicione esse email na variavel{" "}
            <code className="rounded-none bg-muted px-1 py-0.5 text-foreground">ADMIN_EMAILS</code>{" "}
            no ambiente de producao, separado por virgulas quando houver mais de um admin.
          </p>
          <SignOutButton redirectUrl="/sign-in?choose_account=1">
            <Button variant="destructive">Trocar conta Google</Button>
          </SignOutButton>
          <Button asChild variant="outline" className="ml-2">
            <Link href="/sign-in?choose_account=1">Tentar login direto</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
