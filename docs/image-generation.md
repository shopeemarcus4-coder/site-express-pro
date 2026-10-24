# Imagens com Gemini no Site Express

O roteiro foi adaptado do prompt de fotografia comercial fornecido pelo proprietário em `Texto colado.txt` nesta conversa. O texto original era um pacote para uma empresa específica, com quatro arquivos-base, galeria vazia e cores preenchidas. O gerador usa os dados confirmados de **cada** projeto; não presume que todos têm a mesma marca, quantidade de fotos ou produtos.

## Regras de produção

- **Melhorar foto enviada:** a foto original acompanha o pedido. O Gemini deve ajustar exposição, balanço de branco, luz, ruído, nitidez e enquadramento sem mudar produto, cor, material, embalagem, quantidade, pessoa ou instalações. O usuário compara original e resultado antes de aplicar. Um modelo generativo ainda pode cometer alterações; a aprovação visual é indispensável.
- **Criar sem foto:** produz uma cena genérica ilustrativa. Ela não deve representar um produto, prato, equipe, cliente, fachada ou local real da empresa. Ao ser aceita, aparece no site com o aviso visível “Imagem ilustrativa”. Cards de produtos não são gerados sem foto original.
- **Saída:** um arquivo por pedido. Não incorporar textos, logotipos redesenhados, preços, selos ou avaliações à foto. O site mantém esses elementos editáveis.
- **Quatro espaços-base:** capa desktop (16:9), capa mobile (1:1), Sobre desktop (4:3) e Sobre mobile (4:5). Cada um recebe composição própria. A galeria não tem quantidade obrigatória; itens confirmados sem fotos permanecem pendentes.
- **Entrega:** a prévia permite baixar a resposta original do Gemini. O editor reduz uma cópia para caber no projeto e o ZIP de exportação inclui as imagens aplicadas separadamente, além do HTML e um checklist. A resolução solicitada no prompt não é garantida pelo modelo nem pela cópia otimizada do site.

O endpoint é opcional, autenticado, protegido pela origem da solicitação e limitado por organização/dia. A chave fica apenas no servidor. Sem `GEMINI_API_KEY`, `SITE_EXPRESS_ENABLE_AI_IMAGES=1` e armazenamento de contas ativo, não há chamada real ao provedor. Não foi feito teste ao vivo com uma chave do usuário nesta máquina.
