# Manual de utilizacao - Engerama Hub

## 1. O que o APK faz

O Engerama Hub centraliza a rotina de obras, financeiro e insumos em um unico aplicativo.

Principais funcoes:

- Login de usuarios com permissao por perfil.
- Tela de obras e relatorio financeiro.
- Importacao de planilhas Excel de cronograma/financeiro.
- Exportacao de relatorios em PDF e Excel.
- Impressao com pre-visualizacao do relatorio.
- Cadastro, edicao e exclusao de obras.
- Controle de usuarios pelo administrador.
- Cadastro de pedidos de materiais/insumos.
- Fluxo de compras: pendente, em rota e concluido.
- Anexos, fotos, PDFs e nota fiscal nos pedidos.
- Resumo do pedido em PDF.
- Chat de ajuda com respostas prontas e consulta de pedidos.
- Modo offline local com sincronizacao quando a internet voltar.

## 2. Login

1. Abra o APK.
2. Informe usuario e senha.
3. Toque em `Entrar`.

O menu exibido depende da permissao do usuario. Administradores veem todas as areas. Visualizadores veem apenas as telas liberadas.

## 3. Usuarios

Disponivel apenas para administradores.

Nesta tela e possivel:

- Criar usuarios.
- Editar senha.
- Informar telefone/celular.
- Definir se o usuario e administrador ou visualizador.
- Escolher quais telas o usuario pode acessar.
- Escolher quais obras o usuario pode visualizar, quando a tela de obras estiver liberada.

## 4. Obras e financeiro

Na tela `Obras`, o usuario acompanha as obras cadastradas e acessa os detalhes.

Dentro da obra e possivel:

- Ver receita, gasto, resultado e margem.
- Acompanhar curva S.
- Editar medicoes.
- Importar Excel atualizado.
- Gerar relatorio.
- Exportar PDF ou Excel.
- Imprimir somente a obra escolhida.

Quando o Excel e importado, os dados sao atualizados no app e entram na sincronizacao online.

## 5. Insumos e pedidos de material

Na tela `Insumos`, o usuario pode registrar pedidos de material para a obra.

Fluxo do pedido:

1. Obra solicita o material.
2. O pedido fica como `Pendente`.
3. Compras abre o pedido, ajusta informacoes se necessario e registra a compra.
4. O pedido muda para `Em rota`.
5. A obra recebe o material e finaliza.
6. O pedido muda para `Concluido`.

Cada pedido salva:

- Numero do pedido.
- Obra.
- Itens solicitados.
- Quantidade e unidade.
- Quem pediu.
- Data e hora.
- Quem comprou.
- Fornecedor.
- Comentarios de compra.
- Quem recebeu.
- Comentarios de recebimento.
- Fotos e anexos.
- Nota fiscal anexada, quando houver.

## 6. WhatsApp e avisos

Quando um pedido e solicitado ou alterado, o app abre o WhatsApp para enviar a mensagem ao numero fixo do compras.

Quando compras finaliza a compra, o app abre o WhatsApp para enviar a confirmacao ao numero cadastrado do usuario que solicitou o material.

Observacao: por seguranca do Android e do WhatsApp, o envio automatico sem confirmar depende de integracao oficial com WhatsApp Business API. No APK atual, a mensagem e montada automaticamente e o usuario confirma o envio.

## 7. Anexos e PDFs

Nos pedidos e possivel anexar:

- Foto tirada no celular.
- Imagem da galeria.
- PDF.
- NFE em PDF.

O app tambem gera um PDF individual com o resumo do pedido.

## 8. Chat de ajuda

O chat fica no canto da tela apos o login.

Ele ajuda com:

- Status de pedido.
- Como pedir material.
- Como importar Excel.
- Como exportar relatorio.
- Duvidas sobre usuarios, obras e insumos.

Exemplos:

- `qual o status do pedido 001?`
- `pedir material`
- `como exportar pdf?`

## 9. Modo offline e sincronizacao

O app funciona sem internet usando armazenamento local do aparelho.

Quando estiver offline:

- O usuario consegue abrir o app.
- Consegue criar pedidos.
- Consegue alterar dados salvos localmente.
- As mudancas ficam marcadas para sincronizacao.

Quando a internet voltar:

- O app tenta enviar as alteracoes automaticamente.
- Tambem baixa alteracoes feitas por outros usuarios.
- A sincronizacao acontece quando o app esta aberto, quando volta para primeiro plano e em verificacoes periodicas.

Importante: sincronizacao com o app totalmente fechado depende de uma rotina nativa de segundo plano do Android. O app ja esta preparado para sincronizar automaticamente quando voltar a ficar ativo.

## 10. Administracao e seguranca

- O app usa Supabase como backend online.
- A chave usada no APK e publica; nunca use chave privilegiada no frontend.
- As tabelas usam RLS.
- Os dados sao protegidos por usuario autenticado.
- As informacoes ficam compartilhadas dentro da organizacao Engerama.
- Se o Supabase falhar ou a internet cair, o app usa o fallback offline local.

## 11. Arquivos importantes do projeto

- `www/index.html`: estrutura das telas.
- `www/style.css`: visual do app.
- `www/script.js`: logica principal.
- `www/supabase.js`: configuracao do Supabase.
- `www/auth.js`: autenticacao.
- `www/api.js`: sincronizacao online.
- `supabase/schema.sql`: estrutura do banco e RLS.
- `android/app/build/outputs/apk/debug/app-debug.apk`: APK de teste gerado.
