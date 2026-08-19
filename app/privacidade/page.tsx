import Link from "next/link"

export const metadata = {
  title: "Política de privacidade",
  description: "Política de privacidade do Branch Commerce.",
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <article className="space-y-8 text-sm leading-7 text-muted-foreground">
        <header className="space-y-3 border-b pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Branch Commerce
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Política de privacidade
          </h1>
          <p>Última atualização: 15 de julho de 2026.</p>
        </header>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">1. Informações coletadas</h2>
          <p>
            Podemos tratar dados de identificação e autenticação, informações financeiras e de
            estoque inseridas pelo usuário, documentos e anexos enviados, dados de produtos e
            pedidos, configurações de alertas, registros técnicos e informações recebidas das
            integrações autorizadas com Mercado Livre e Mercado Pago.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">2. Como usamos os dados</h2>
          <p>
            Usamos os dados para autenticar usuários, operar os recursos contratados, sincronizar
            vendas e estoque, produzir relatórios, proteger a plataforma, prestar suporte e cumprir
            obrigações legais. Documentos enviados para análise automatizada podem ser processados
            por provedores de inteligência artificial somente para executar a função solicitada.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">3. Fornecedores</h2>
          <p>
            Utilizamos prestadores essenciais, incluindo Clerk para autenticação, Convex para banco
            de dados e armazenamento, infraestrutura de hospedagem e, quando ativados pelo usuário,
            Mercado Livre, Mercado Pago, Telegram e serviços de inteligência artificial. Cada
            fornecedor trata dados conforme sua própria política e as instruções do Branch Commerce.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">4. Retenção e segurança</h2>
          <p>
            Mantemos os dados enquanto a conta estiver ativa ou pelo período necessário para as
            finalidades descritas. Aplicamos controles de acesso, criptografia em trânsito e outras
            medidas razoáveis de segurança. Nenhum sistema é totalmente imune a incidentes, mas
            atuamos para reduzir riscos e responder a ocorrências.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">5. Seus direitos</h2>
          <p>
            Você pode solicitar acesso, correção, portabilidade ou exclusão de dados, além de
            revogar consentimentos aplicáveis. Para excluir a conta, use a página pública de
            solicitação. A conclusão ocorre normalmente em até 30 dias, salvo retenção exigida por
            lei, prevenção a fraudes ou exercício regular de direitos.
          </p>
          <Link
            href="/excluir-conta"
            className="mt-3 inline-flex font-semibold text-primary underline"
          >
            Solicitar exclusão da conta
          </Link>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">6. Atualizações e contato</h2>
          <p>
            Esta política pode ser atualizada para refletir mudanças no produto ou na legislação.
            Para dúvidas de privacidade, utilize a área Conta e privacidade dentro da plataforma.
          </p>
        </section>
      </article>
    </main>
  )
}
