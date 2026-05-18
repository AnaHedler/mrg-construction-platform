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

## Android APK

```bash
npx cap sync
cd android
.\gradlew assembleDebug
```
