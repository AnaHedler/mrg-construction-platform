# Engerama Hub

Plataforma operacional para construção civil com foco em controle financeiro, gestão de compras, solicitações de materiais, dashboards operacionais e integração mobile.

## Segurança

Este pacote foi sanitizado e não contém:

* Senhas reais
* Tokens privados
* Chaves secretas
* Credenciais de produção
* Keystore de assinatura
* Artefatos de build (`dist`, APK ou AAB)

## Configuração Supabase

O arquivo `www/app-config.js` está vazio propositalmente:

```js
supabaseUrl: ''
supabaseAnonKey: ''
```

Configure as variáveis de ambiente na Vercel:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
ENGERAMA_ORG_ID
```

## Build do Projeto

```bash
npm install
npm run build
```

## Deploy Vercel

```bash
npx vercel login
npx vercel --prod
```

### Configuração

* Build Command: `npm run build`
* Output Directory: `dist`
