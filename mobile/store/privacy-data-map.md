# Mapa de dados para as lojas

Use este documento como base para os formulários Data Safety e App Privacy. Revise novamente sempre que
um SDK, integração ou recurso for adicionado.

## Dados tratados

| Categoria               | Exemplos                                       | Finalidade                        | Vinculado ao usuário |
| ----------------------- | ---------------------------------------------- | --------------------------------- | -------------------- |
| Identificação           | Nome, e-mail e ID Clerk                        | Login, conta e controle de acesso | Sim                  |
| Informações financeiras | Receitas, despesas, relatórios e movimentações | Funcionalidade do app             | Sim                  |
| Compras e pedidos       | Pedidos e itens sincronizados                  | Operação de e-commerce            | Sim                  |
| Conteúdo do usuário     | Documentos, anexos, produtos e observações     | Funcionalidade do app             | Sim                  |
| Identificadores         | ID interno e IDs das integrações               | Segurança e sincronização         | Sim                  |
| Diagnóstico técnico     | Erros e estado de sincronização                | Estabilidade e suporte            | Sim                  |

## Processadores e integrações

- Clerk: autenticação e metadados da conta.
- Convex: banco de dados, funções e armazenamento de arquivos.
- Vercel: hospedagem do aplicativo web e APIs.
- Mercado Livre e Mercado Pago: somente quando conectados pelo usuário.
- Telegram: somente quando alertas forem ativados.
- OpenAI: somente nos fluxos de análise de documentos/produtos que utilizarem IA.

## Declarações atuais

- Sem publicidade de terceiros.
- Sem venda de dados pessoais.
- Sem rastreamento entre aplicativos/sites para publicidade.
- Dados criptografados em trânsito por HTTPS.
- Exclusão solicitável dentro do app e em URL pública.
- Retenção adicional somente para obrigação legal, segurança, fraude ou exercício de direitos.

## URLs de comprovação

- Política: `https://branchcommercehub.com/privacidade`
- Exclusão: `https://branchcommercehub.com/excluir-conta`
- Android App Links: `https://branchcommercehub.com/.well-known/assetlinks.json`
- Apple Universal Links: `https://branchcommercehub.com/.well-known/apple-app-site-association`
