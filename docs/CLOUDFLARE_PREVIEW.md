# Prévia local da versão Cloudflare

O build deste projeto produz um Cloudflare Worker em `.output/server`. O `vite preview` padrão procura `dist/server/server.js`, que este build não cria, e por isso devolve HTTP 500. Use a prévia do Worker:

```bash
npm run build
npm run preview
```

A prévia abre `http://127.0.0.1:4173`. Para outra porta, use `npm run preview -- 4191`. O comando usa Wrangler 4.93.1, obtido pelo npm em um cache temporário com scripts de instalação desativados. A configuração de teste fica em `.output/server/wrangler.preview.json`, ignorada pelo Git, e contém um banco D1 **local** com ID fictício. Os dados locais ficam em `/tmp/site-express-preview/state`; a prévia não publica o projeto e não acessa uma conta Cloudflare nem a IA da Lovable.

O Nitro gera `compatibility_date` com a data atual. O `workerd` incluído no Wrangler 4.93.1 aceita no máximo `2026-05-27`; por isso a configuração **somente da prévia** fixa essa data. O arquivo de deploy continua independente. Depois de iniciar a prévia, teste registro, login, salvamento de projeto, publicação em `/site/<slug>`, suspensão e logout. A prévia usa um banco de testes; ela não comprova que um banco D1 real esteja vinculado na hospedagem. Para preparar esse vínculo, consulte [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md).
