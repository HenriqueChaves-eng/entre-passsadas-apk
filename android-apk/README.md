# APK Android - Ajuste Entre-Passadas

Esta pasta empacota o app offline aprovado em um APK Android usando Capacitor.

## Gerar pelo GitHub Actions

1. Suba para o GitHub a pasta `android-apk` e o arquivo `.github/workflows/build-android-apk.yml`.
2. No GitHub, abra o repositorio e entre em `Actions`.
3. Abra o workflow `Gerar APK Android`.
4. Clique em `Run workflow`.
5. Ao terminar, baixe o artifact `ajuste-entre-passadas-debug-apk`.
6. Extraia o ZIP do artifact e instale o arquivo `app-debug.apk` no Android.

Depois de instalado, o app roda offline porque os arquivos web ficam dentro do APK.

## Gerar pelo Android Studio

No computador com Node.js, Java JDK e Android Studio instalados:

```powershell
cd android-apk
npm install
npx cap add android
npx cap sync android
npx cap open android
```

No Android Studio, use `Build > Build Bundle(s) / APK(s) > Build APK(s)`.

## Atualizar o app web dentro do APK

Quando mudar o app principal, copie novamente estes arquivos para `android-apk/www`:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- pasta `assets`
