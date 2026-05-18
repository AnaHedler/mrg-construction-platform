# MRG Construction Platform

Plataforma operacional para construção civil focada em controle financeiro, gestão de compras, solicitações de materiais, dashboards operacionais e integração mobile.

## Principais recursos 

- Controle financeiro mensal das obras
- Solicitação de materiais via mobile
- Alertas financeiros e operacionais
- Gestão do fluxo de pedidos e aprovações
- Controle de compras e suprimentos
- Dashboards operacionais em tempo real
- Importação e exportação de planilha com dados do Excel
- Geração de resumo financeiro completo da obra em PDF
- Controle multiusuário com permissões de acesso
- Auditoria e histórico de alterações
- Integração com Supabase
- Aplicação Android via Capacitor (APK)

## Tecnologias

* HTML
* CSS
* JavaScript
* Capacitor
* Supabase
* Android Studio
* Node.js

## Mobile

Aplicação convertida para APK Android utilizando Capacitor.

## Estrutura do Projeto

```text
android/
resources/
scripts/
supabase/
www/
```

## Build

```bash
npm install
npm run build
```

## Supabase / Vercel

Configure estas variáveis na Vercel, sem commitar valores reais:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
ENGERAMA_ORG_ID=
```

Rode `supabase/schema.sql` no SQL Editor do Supabase. O sistema usa Supabase Auth para login, tabelas reais com RLS e políticas por empresa. Não use chave privilegiada no front-end.

Com Supabase configurado, o app não grava obras, pedidos, compras, usuários ou dados financeiros completos em `localStorage`; esses dados vêm da base online após login.

O primeiro usuário autenticado pode ser promovido pelo fluxo seguro `setup_first_admin`, desde que a função SQL esteja instalada. Depois disso, os perfis e permissões são carregados da tabela `usuarios`.

## Android APK

Para o APK, configure `www/app-config.js` no ambiente de empacotamento com a URL do Supabase e a chave anon/publicável. A chave `anon` pode ir no app; nunca coloque chaves privilegiadas ou segredos no APK.

```bash
npx cap sync
cd android
.\gradlew assembleDebug
```

Se o Supabase estiver indisponível, o app avisa o usuário e mantém funcionamento offline temporário somente na sessão atual, sincronizando quando a conexão voltar.
