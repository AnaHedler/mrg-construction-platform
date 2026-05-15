# Engerama Hub - Backend e Publicacao

Este app ja esta preparado para usar backend online. Enquanto `www/app-config.js` estiver com `apiBaseUrl: ''`, ele funciona localmente. Para todos os APKs compartilharem os mesmos usuarios e pedidos, hospede o backend e coloque a URL em `apiBaseUrl`.

## Rodar backend local

```bash
node backend/server.js
```

Depois ajuste:

```js
window.ENGERAMA_CONFIG = {
  apiBaseUrl: 'http://SEU-IP-OU-DOMINIO:8787',
  enablePush: false,
  appVersion: '1.0.0'
};
```

## O que ja fica pronto

- Login via backend quando `apiBaseUrl` esta configurado.
- Banco online em `backend/database.json`.
- Sincronizacao multiusuario de obras, usuarios, pedidos de insumo e unidades.
- Pedidos novos sao unidos por ID para evitar que um aparelho anule o pedido criado por outro.
- O app continua com fallback local se o backend nao estiver configurado.

## Itens que exigem credenciais

- Push real: precisa Firebase/FCM e `google-services.json`.
- APK release assinado/AAB: precisa criar e guardar uma keystore real.
- Play Store: precisa conta Google Play Console e envio manual/oficial.
- Atualizacao automatica: exige app publicado na Play Store ou servidor de atualizacao.

## Build Android

Use JDK 21 para este projeto Capacitor:

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```

Debug:

```bash
cd android
gradlew.bat assembleDebug
```

Release/AAB assinado:

1. Crie uma keystore real e segura.
2. Copie `android/keystore.properties.example` para `android/keystore.properties`.
3. Ajuste senhas, alias e caminho da keystore.
4. Rode `gradlew.bat assembleRelease` ou `gradlew.bat bundleRelease`.
