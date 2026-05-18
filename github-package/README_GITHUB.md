# Engerama Hub

Pacote pronto para publicar no GitHub.

## Segurança

- Nao ha senha padrao no codigo.
- Nao ha Supabase URL/key fixa no `www/app-config.js`.
- Nao ha chave privilegiada no frontend.
- O cadastro local usa `passwordHash` e remove senhas antigas salvas no navegador ao abrir o app.
- Para Vercel, configure as variaveis no painel do projeto:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `ENGERAMA_ORG_ID`

## Build

```bash
npm install
npm run build
```

## Android / Capacitor

```bash
npx cap copy android
npx cap open android
```

O pacote nao inclui `dist`, `node_modules`, `.vercel`, APK/AAB, keystore ou assets Android gerados.
