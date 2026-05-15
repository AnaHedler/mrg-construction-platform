# MRG Construction Platform

Plataforma operacional para construção civil focada em controle financeiro, gestão de compras, solicitações de materiais, dashboards operacionais e integração mobile.

## Principais Recursos

* Controle financeiro mensal
* Solicitação de materiais
* Gestão de fluxo dos pedidos
* Controle de compras
* Dashboards operacionais
* Exportação PDF e Excel
* Controle multiusuário
* Auditoria de alterações
* Integração com Supabase
* APK Android via Capacitor

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
