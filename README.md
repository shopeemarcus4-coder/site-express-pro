# Site Express

Aplicativo para criar, editar e exportar sites de negócios. A interface pública usa o visual aprovado do Site Express; os sites criados podem ter identidade própria.

O projeto está [conectado à Lovable](https://lovable.dev/projects/c1265820-e937-43ca-8589-c00d929f3e34). Alterações enviadas à branch `main` do [repositório](https://github.com/shopeemarcus4-coder/site-express-pro) sincronizam com o editor. O desenvolvimento deste projeto é feito pelo código e GitHub, sem usar a IA ou créditos da Lovable.

## Criar um site

Abra `/app`. O criador agora começa diretamente, sem cadastro ou login. Os rascunhos ficam neste navegador e o editor exporta HTML e ZIP para guardar ou hospedar o site. Não há administração, preços nem publicação automática nesta fase. Contas e publicação por link ficam pausadas; seus APIs antigos permanecem no código para uma fase futura, mas o criador não depende de um banco D1.

A busca de empresas e as fotos do Google são opcionais. Para usá-las **sem conta e sem D1**, configure no ambiente do servidor `GOOGLE_PLACES_API_KEY`, `SITE_EXPRESS_ENABLE_PLACES=1` e `SITE_EXPRESS_ENABLE_PUBLIC_PLACES=1`; para ver fotos, configure também `SITE_EXPRESS_ENABLE_PLACES_PHOTOS=1`. Nota média, contagem e até cinco avaliações reais exigem ativação separada com `SITE_EXPRESS_ENABLE_PLACES_REVIEWS=1`. A API retorna até dez referências de fotos por empresa, não a galeria completa do Google. O uso público pode consumir cota ou gerar cobrança no Google Cloud: defina cotas e limites na sua conta antes de ativá-lo. As fotos do Google aparecem como referência com créditos; elas não são copiadas para o site gerado. Envie fotos próprias ou autorizadas ao criar o projeto ou no editor para publicar ou exportar.

Sem essas configurações, a busca explica por que está indisponível e a criação manual continua funcionando. A geração de imagens com Gemini pode funcionar sem login quando `GEMINI_API_KEY`, `SITE_EXPRESS_ENABLE_AI_IMAGES=1`, `SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES=1` e o banco D1 `SITE_EXPRESS_DB` estiverem configurados no servidor; ela tem limites diários por visitante e globais. Sem essas condições, o editor informa indisponibilidade e não chama o Gemini. A reescrita de texto e as minutas de contrato estão fora da interface por enquanto. Nenhuma chave deve entrar no repositório. Veja [as regras de imagem](docs/image-generation.md).

Para desenvolver localmente, use `npm run dev`, `npm test`, `npm run build` e `npm run lint`. Consulte [as regras do projeto](regra.md) para a recomendação da IA em cada processo. O [armazenamento D1](src/lib/server/README.md) é necessário para limitar com segurança o Gemini público. O [preparo Cloudflare](docs/CLOUDFLARE_DEPLOY.md) e a [preparação Vercel](docs/VERCEL_PUBLISH.md) estão documentados; a publicação direta pelo editor ainda depende de acesso seguro à conta Vercel.
