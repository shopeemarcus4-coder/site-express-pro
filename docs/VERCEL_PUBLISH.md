# Publicar um site gerado na Vercel

O editor gera um HTML independente. A Vercel pode hospedar esse arquivo como site estático. A publicação **dentro do editor, em um clique**, ainda depende de um modo seguro de identificar quem pode publicar: sem login, uma rota pública com token da Vercel permitiria que qualquer visitante usasse a conta do proprietário. Não coloque `VERCEL_TOKEN` no navegador, no GitHub ou em um endpoint público.

## Preparar sem publicar

1. No editor, revise textos, contatos, fotos e a prévia para celular; clique em **Baixar HTML**.
2. No computador que tem este repositório, execute `node scripts/prepare-vercel-site.mjs /caminho/para/site.html nome-do-site`. No Windows, use o caminho local entre aspas. O script verifica o HTML e prepara `.vercel-sites/nome-do-site/index.html` sem instalar nada, usar créditos ou fazer deploy.
3. Confira o arquivo preparado. Se preparar uma versão nova do **mesmo** site, compare-a com a atual e execute novamente com `--update`. O script não troca um HTML diferente sem essa opção.

Cada nome produz uma pasta isolada; o vínculo que a CLI da Vercel cria para esse site fica nessa pasta. `.vercel-sites/` é ignorada pelo Git para evitar publicar arquivos de clientes ou metadados da conta no repositório.

## Publicar quando a conta estiver pronta

Na pasta `.vercel-sites/nome-do-site`, use a [CLI oficial da Vercel](https://github.com/vercel/vercel/tree/main/packages/cli). A versão `vercel@65.2.0` foi verificada no registro npm em 24/10/2026: licença Apache-2.0 e Node.js 20 ou mais recente. O comando `npx --yes vercel@65.2.0 --prod` instala a CLI apenas no cache do npm, pede entrada na **sua** conta Vercel e faz o deploy da pasta atual. Ele não deve ser executado antes de conferir o projeto, a conta e as condições do plano Vercel. A Vercel decide o endereço final e eventuais limites ou custos do plano; esta preparação não promete hospedagem gratuita em todas as situações.

Depois, abra o endereço fornecido pela Vercel e confira desktop, celular, imagens e links. O HTML incorpora as imagens que você enviou ao editor; URLs externas ainda dependem dos provedores originais. Para atualização, prepare o novo HTML com `--update` e faça outro deploy da **mesma pasta**.

Este fluxo publica o **site gerado**, separado da aplicação Site Express que está ligada à Lovable. Ainda não há integração de domínio próprio, publicação automática nem reversão pelo editor. Para oferecer um botão dentro do aplicativo no futuro, será necessário um fluxo de autorização Vercel por usuário ou um backend privado com controle de acesso e limite de uso.
