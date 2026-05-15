# Supabase no Engerama Hub

Arquivos do app:

- `www/supabase.js`: cria o client Supabase com URL e anon/publishable key.
- `www/auth.js`: login com Supabase Auth e sessao persistida no APK.
- `www/api.js`: sincronizacao online com fallback local offline.
- `supabase/schema.sql`: tabelas, RLS e policies.

## Como ativar no Supabase

1. Abra o SQL Editor do Supabase.
2. Rode o arquivo `supabase/schema.sql`.
3. Crie usuarios no Supabase Auth.
4. Para login por nome curto, use e-mails no padrao:

```text
admin@engerama.local
joao@engerama.local
```

O app tambem aceita e-mail completo no campo usuario.

## Dados compartilhados

As solicitacoes de insumos, obras, relatorios financeiros, unidades e usuarios do app ficam em `app_records`.
Esses registros agora sao compartilhados pela organizacao Engerama (`org_id`), entao todos os usuarios autenticados da mesma organizacao recebem as mesmas alteracoes.

O campo `owner_id` continua salvo apenas para auditoria de quem criou ou enviou a alteracao.

## Seguranca

- O frontend usa somente anon/publishable key.
- Nunca coloque chave privilegiada no app.
- RLS esta ativado e forcado em `organizations`, `profiles` e `app_records`.
- Todas as policies usam `auth.uid()`.
- Usuarios autenticados acessam somente dados da propria organizacao.
- CRUD em `app_records` e protegido por usuario autenticado e `org_id`.

## Modo offline

Se Supabase estiver sem internet, CDN bloqueado, sem sessao ou com erro, o app continua usando `localStorage`.

Toda alteracao local marca uma sincronizacao pendente. Quando a internet volta, quando o app volta para primeiro plano ou durante a verificacao periodica, o app tenta enviar as pendencias e baixar as mudancas feitas por outros usuarios.

Observacao: sincronizacao com o Android totalmente fechado exige rotina nativa de segundo plano, como WorkManager/background task. O JavaScript do WebView sincroniza automaticamente enquanto o app esta aberto, em segundo plano leve ou quando e reaberto.
