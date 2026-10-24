# Site Express

Aplicativo para criar, editar e exportar sites de negócios. A interface pública usa o visual aprovado do Site Express; os sites criados podem ter identidade própria.

O projeto está [conectado à Lovable](https://lovable.dev/projects/c1265820-e937-43ca-8589-c00d929f3e34). Alterações enviadas à branch `main` do [repositório](https://github.com/shopeemarcus4-coder/site-express-pro) sincronizam com o editor. O desenvolvimento deste projeto é feito pelo código e GitHub, sem usar a IA ou créditos da Lovable.

## Uso local

Com Node.js e as dependências disponíveis:

```sh
npm run dev
npm run build
npm run test
npm run lint
```

Abra `/app` para criar um site. O modo local guarda rascunhos neste navegador e permite exportar um HTML independente. Contas, salvamento entre dispositivos e publicação por link exigem um banco persistente na hospedagem. Consulte [a configuração do servidor](src/lib/server/README.md) antes de ativar essas funções em produção.

Google Places e reescrita com IA são opcionais, ficam desativados sem chaves e não são necessários para criar sites manualmente. As minutas de contrato precisam de revisão jurídica antes de uso externo. Leia [as regras do projeto](regra.md) para a recomendação da IA em cada novo processo.

Para buscar empresas e mostrar as fotos do Google em uma conta autenticada, configure no servidor `GOOGLE_PLACES_API_KEY`, `SITE_EXPRESS_ENABLE_PLACES=1` e `SITE_EXPRESS_ENABLE_PLACES_PHOTOS=1`. Cada foto exibida consulta o Google Photo Media e pode consumir a cota ou gerar cobrança do Google Cloud; por isso, o interruptor de fotos é separado. O Site Express mostra até oito fotos como referência e seus créditos, mas não inclui fotos do Google no site publicado ou no HTML exportado. A capa final deve ser enviada pelo usuário na aba Marca. Veja [a análise da referência Emergent](docs/emergent-reference.md).

Na Lovable, cadastre os valores em **Secrets/Environment Variables** do projeto, sem colocar chaves no código ou em arquivos versionados. A reescrita opcional de texto usa `GEMINI_API_KEY` e `SITE_EXPRESS_ENABLE_AI=1` (modelo padrão: `gemini-2.5-flash`; `SITE_EXPRESS_GEMINI_MODEL` é opcional). A criação e melhoria de imagens usa a mesma chave, mas exige ativação separada com `SITE_EXPRESS_ENABLE_AI_IMAGES=1` (modelo padrão: `gemini-2.5-flash-image`; `SITE_EXPRESS_GEMINI_IMAGE_MODEL` é opcional). O limite interno padrão é **4 pedidos de imagem por organização por dia UTC**; `SITE_EXPRESS_IMAGE_DAILY_LIMIT` pode definir um inteiro entre 1 e 20. Cada pedido exige clique explícito, pode consumir cota ou gerar cobrança no provedor e só aplica a imagem após aprovação da prévia. A busca usa `GOOGLE_PLACES_API_KEY` e `SITE_EXPRESS_ENABLE_PLACES=1`; as fotos exigem também `SITE_EXPRESS_ENABLE_PLACES_PHOTOS=1`. O Google Places requer um projeto Google Cloud com Places API (New) habilitada e pode exigir faturamento. Os segredos são lidos das variáveis do servidor Cloudflare em cada solicitação. Para usar as telas autenticadas na hospedagem, também é necessário o banco D1 `SITE_EXPRESS_DB` descrito [aqui](src/lib/server/README.md); as chaves sozinhas não ativam login, salvamento nem imagens.

O buscador também aparece no modo local. Para permitir consultas sem login e sem D1, adicione `SITE_EXPRESS_ENABLE_PUBLIC_PLACES=1`. Essa opção expõe a cota de Google Places a visitantes do site; configure limites de uso no Google Cloud antes de ativá-la. Sem esse interruptor, a busca pública informa que exige conta, enquanto a criação manual continua disponível.

No editor de uma conta, os botões “Melhorar ... com IA” enviam o texto informado ao Gemini somente quando alguém clica. A IA reescreve a descrição inicial ou a história; não cria fatos, avaliações ou fotos e não substitui a revisão antes da publicação.
