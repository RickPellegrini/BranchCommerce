# Branch Commerce Mobile

Aplicativo Android e iOS gerado com Capacitor 8. O shell nativo carrega o Next.js publicado em
`https://branchcommercehub.com/mobile`. No Android, o login usa o `AuthView` nativo do Clerk e
troca a sessão com o WebView por um ticket de uso único.

## Identidade

- Nome: `Branch Commerce`
- Android application ID: `com.branchcommercehub.app`
- iOS bundle ID: `com.branchcommercehub.app`
- URL scheme: `branchcommerce://`
- Android: min SDK 24, target/compile SDK 36
- Versão atual: `1.2.3` (`versionCode`/build `9`)

## Comandos

Na raiz do repositório:

```powershell
npm run mobile:sync
npm run mobile:android
```

Na pasta `mobile`:

```powershell
npm run android:debug
npm run android:release
npm run ios:open
```

O script Android usa o JDK e SDK portáteis em `.tools`. O release também requer
`mobile/android/keystore.properties` e a chave em `mobile/.signing`; ambos são ignorados pelo Git.

## Saídas Android

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Play Store AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Entrega atual: `dist/branch-commerce-1.2.3.apk` e `dist/branch-commerce-1.2.3.aab`

## iOS

O projeto está em `ios/App/App.xcodeproj` e usa Swift Package Manager. O binário iOS precisa ser
gerado em macOS com Xcode 26 ou mais recente. Antes do archive, configure o Apple Team, defina
`APPLE_TEAM_ID` na Vercel e confirme que `/.well-known/apple-app-site-association` responde `200`.

## Segurança

Nunca envie ao Git os arquivos de `.signing`, `keystore.properties`, certificados Apple ou perfis de
provisionamento. A chave Android criada para o primeiro release precisa de backup seguro; sem ela,
atualizações futuras podem ficar impossíveis fora do Play App Signing.
