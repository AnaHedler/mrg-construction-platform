# Supabase Multiusuário - Engerama Hub

Use `supabase/schema.sql` no SQL Editor do Supabase para criar o banco online real do app.

## Tabelas principais

- `empresas`
- `usuarios`
- `obras`
- `pedidos`
- `itens_pedido`
- `compras`
- `auditoria`
- `notificacoes`

Todas as tabelas têm RLS ativado e políticas por empresa/organização.

## Login seguro

O login usa Supabase Auth. Senhas não ficam em tabelas públicas.

Fluxo recomendado:

1. Crie o usuário em **Authentication > Users**.
2. Use e-mail real ou o padrão `login@engerama.local`.
3. Copie o UUID do usuário Auth.
4. Insira o cadastro correspondente em `public.usuarios`, com `empresa_id`, `perfil`, módulos e obras permitidas.

O SQL já inclui um bloco comentado para criar o primeiro admin com segurança.

## Variáveis de ambiente

Configure na Vercel:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ENGERAMA_ORG_ID`

No front-end use somente a anon/publishable key. Nunca coloque chave privilegiada no HTML, JS, GitHub, Vercel pública ou APK.

## Perfis

- `admin`: gerencia usuários, permissões, obras e pedidos.
- `compras`: vê pedidos e registra compras.
- `financeiro`: vê obras e dados financeiros.
- `obra`: solicita materiais e recebe pedidos nas obras permitidas.
- `visualizador`: apenas visualiza telas/obras permitidas.

## Fallback local

Com Supabase configurado, o app não persiste obras, pedidos, compras ou dados financeiros completos em `localStorage`. Se a conexão cair, as alterações podem ficar temporariamente na memória da sessão e o usuário é avisado. A sessão permitida do Supabase continua sob controle da própria biblioteca Supabase.
