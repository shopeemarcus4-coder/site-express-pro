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
