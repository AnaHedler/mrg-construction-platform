# Engerama Hub

Plataforma operacional para construcao civil com controle financeiro, compras, solicitacoes de materiais, dashboards, auditoria e app mobile via Capacitor.

## Seguranca

Este pacote nao deve conter:

* Senhas reais
* Tokens privados
* Chaves secretas
* Credenciais de producao
* Keystore de assinatura
* Artefatos de build (`dist`, APK ou AAB)

## Configuracao Supabase

O arquivo `www/app-config.js` fica sem credenciais reais no GitHub:

```js
supabaseUrl: ''
supabaseAnonKey: ''
```

Configure na Vercel:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
ENGERAMA_ORG_ID=
```

Depois rode `supabase/schema.sql` no SQL Editor do Supabase.

O login usa Supabase Auth. A tabela `usuarios` guarda permissao, telefone, empresa e obras permitidas, nunca senha em texto puro.

## Build

```bash
npm install
npm run build
```

## Deploy Vercel

```bash
npx vercel --prod
```

* Build Command: `npm run build`
* Output Directory: `dist`
