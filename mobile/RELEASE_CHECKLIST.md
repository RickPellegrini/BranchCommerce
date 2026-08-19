# Checklist de lançamento

## Concluído no código

- [x] Capacitor 8 isolado em `mobile`.
- [x] Projetos Android e iOS gerados.
- [x] Application/bundle ID `com.branchcommercehub.app`.
- [x] Android API 36 e min API 24.
- [x] APK debug compilado.
- [x] APK release e AAB assinados.
- [x] Ícones e splash Android/iOS.
- [x] Deep links e Android App Links.
- [x] Login Android com `AuthView` nativo do Clerk e Google One Tap.
- [x] iOS associated domains preparado.
- [x] Estado offline, safe areas, botão voltar e haptics.
- [x] Manifest web e metadados mobile.
- [x] Política pública e solicitação de exclusão de conta.
- [x] Produção publicada em `branchcommercehub.com`.
- [x] Lint, TypeScript, testes e builds validados.

## Google Play Console

- [ ] Confirmar/abrir conta de desenvolvedor como organização e concluir verificação.
- [ ] Criar app com package `com.branchcommercehub.app` e idioma pt-BR.
- [ ] Ativar Play App Signing e guardar backup da chave de upload local.
- [ ] Enviar `dist/branch-commerce-1.2.3.aab`.
- [ ] Informar política e URL de exclusão de conta.
- [ ] Preencher Data Safety usando `store/privacy-data-map.md`.
- [ ] Preencher classificação etária, público-alvo e declarações de conteúdo.
- [ ] Fornecer conta de demonstração com dados fictícios para revisão.
- [ ] Produzir screenshots de telefone e feature graphic.
- [ ] Rodar teste interno/fechado e promover para produção.

## App Store Connect

- [ ] Confirmar/abrir Apple Developer Program como organização.
- [ ] Obter Team ID e configurar `APPLE_TEAM_ID` na Vercel.
- [ ] Confirmar resposta `200` de `/.well-known/apple-app-site-association`.
- [ ] Abrir o projeto em macOS/Xcode 26 e selecionar o Apple Team.
- [ ] Confirmar capabilities Associated Domains e assinatura automática.
- [ ] Executar Archive, validar e enviar ao App Store Connect.
- [ ] Preencher App Privacy usando `store/privacy-data-map.md`.
- [ ] Fornecer conta de demonstração e instruções de revisão.
- [ ] Produzir screenshots de iPhone/iPad exigidos pelo App Store Connect.
- [ ] Distribuir no TestFlight e, após teste, enviar para revisão.

## Operação obrigatória

- [ ] Verificar periodicamente usuários com `privateMetadata.accountDeletionRequest.status=requested`.
- [ ] Excluir dados associados no Convex, revogar integrações e excluir o usuário Clerk em até 30 dias.
- [ ] Registrar a conclusão da solicitação sem manter dados além do necessário.
