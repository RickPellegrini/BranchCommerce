param(
    [ValidateSet("Debug", "Release")]
    [string]$Mode = "Debug"
)

$ErrorActionPreference = "Stop"
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repositoryRoot = (Resolve-Path (Join-Path $mobileRoot "..")).Path
$jdkBase = Join-Path $repositoryRoot ".tools\jdk"
$androidSdk = Join-Path $repositoryRoot ".tools\android-sdk"
$jdk = Get-ChildItem -LiteralPath $jdkBase -Directory | Select-Object -First 1

if (-not $jdk) {
    throw "JDK portatil nao encontrado em $jdkBase. Consulte mobile/README.md."
}

if (-not (Test-Path -LiteralPath $androidSdk)) {
    throw "Android SDK nao encontrado em $androidSdk. Consulte mobile/README.md."
}

$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk

Push-Location $mobileRoot
try {
    & npm.cmd run sync
    if ($LASTEXITCODE -ne 0) { throw "Falha ao sincronizar o Capacitor." }

    Push-Location (Join-Path $mobileRoot "android")
    try {
        if ($Mode -eq "Release") {
            & .\gradlew.bat bundleRelease assembleRelease
        } else {
            & .\gradlew.bat assembleDebug
        }
        if ($LASTEXITCODE -ne 0) { throw "Falha no build Android $Mode." }
    } finally {
        Pop-Location
    }

    if ($Mode -eq "Release") {
        $buildGradle = Get-Content -LiteralPath (Join-Path $mobileRoot "android\app\build.gradle") -Raw
        $versionMatch = [regex]::Match($buildGradle, 'versionName\s+"([^"]+)"')
        if (-not $versionMatch.Success) { throw "Nao foi possivel identificar a versao Android." }

        $versionName = $versionMatch.Groups[1].Value
        $distDir = Join-Path $mobileRoot "dist"
        $publicDownloadDir = Join-Path $repositoryRoot "public\downloads"
        New-Item -ItemType Directory -Force -Path $distDir, $publicDownloadDir | Out-Null

        $releaseApk = Join-Path $mobileRoot "android\app\build\outputs\apk\release\app-release.apk"
        $releaseBundle = Join-Path $mobileRoot "android\app\build\outputs\bundle\release\app-release.aab"
        Copy-Item -LiteralPath $releaseApk -Destination (Join-Path $distDir "branch-commerce-$versionName.apk") -Force
        Copy-Item -LiteralPath $releaseBundle -Destination (Join-Path $distDir "branch-commerce-$versionName.aab") -Force
        Copy-Item -LiteralPath $releaseApk -Destination (Join-Path $publicDownloadDir "branch-commerce-android.apk") -Force
    }
} finally {
    Pop-Location
}
