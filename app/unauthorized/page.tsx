import { SignOutButton } from "@clerk/nextjs"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Acesso negado</CardTitle>
          <CardDescription>
            Sua conta nao possui permissao para acessar a plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <SignOutButton>
            <Button variant="destructive">Sair da conta</Button>
          </SignOutButton>
        </CardContent>
      </Card>
    </main>
  )
}
