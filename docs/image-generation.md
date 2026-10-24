# Imagens com Gemini no Site Express

O roteiro foi adaptado do prompt de fotografia comercial fornecido pelo proprietário em `Texto colado.txt` nesta conversa. O texto original era um pacote para uma empresa específica, com quatro arquivos-base, galeria vazia e cores preenchidas. O gerador usa os dados confirmados de **cada** projeto; não presume que todos têm a mesma marca, quantidade de fotos ou produtos.

## Regras de produção

- **Melhorar foto enviada:** a foto original acompanha o pedido. O Gemini deve ajustar exposição, balanço de branco, luz, ruído, nitidez e enquadramento sem mudar produto, cor, material, embalagem, quantidade, pessoa ou instalações. O usuário compara original e resultado antes de aplicar. Um modelo generativo ainda pode cometer alterações; a aprovação visual é indispensável.
- **Criar sem foto:** produz uma cena genérica ilustrativa. Ela não deve representar um produto, prato, equipe, cliente, fachada ou local real da empresa. Ao ser aceita, aparece no site com o aviso visível “Imagem ilustrativa”. Cards de produtos não são gerados sem foto original.
- **Saída:** um arquivo por pedido. Não incorporar textos, logotipos redesenhados, preços, selos ou avaliações à foto. O site mantém esses elementos editáveis.
- **Quatro espaços-base:** capa desktop (16:9), capa mobile (1:1), Sobre desktop (4:3) e Sobre mobile (4:5). Cada um recebe composição própria. A galeria não tem quantidade obrigatória; itens confirmados sem fotos permanecem pendentes.
- **Entrega:** a prévia permite baixar a resposta original do Gemini. O editor reduz uma cópia para caber no projeto e o ZIP de exportação inclui as imagens aplicadas separadamente, além do HTML e um checklist. A resolução solicitada no prompt não é garantida pelo modelo nem pela cópia otimizada do site.

O endpoint é opcional e pode funcionar **sem conta** em um Cloudflare Worker com banco D1 `SITE_EXPRESS_DB`. Exige a chave `GEMINI_API_KEY` no servidor e os interruptores `SITE_EXPRESS_ENABLE_AI_IMAGES=1` e `SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES=1`. Todos devem estar presentes; a chave não vai para o navegador. A hospedagem também precisa fornecer o endereço do visitante pelo cabeçalho confiável `CF-Connecting-IP`. Sem D1, o endpoint informa indisponibilidade e não chama o Gemini.

O servidor exige origem do próprio site e grava no D1 um resumo criptográfico do endereço do visitante, sem guardar o endereço em texto. O limite padrão é **4 pedidos por visitante por dia UTC**, com teto global de **20 pedidos por dia UTC**, inclusive pedidos que falharem após a chamada. Os limites podem ser configurados com `SITE_EXPRESS_IMAGE_DAILY_LIMIT` (1 a 20) e `SITE_EXPRESS_IMAGE_GLOBAL_DAILY_LIMIT` (1 a 100). Os dois contadores são persistentes e cada incremento é atômico; um visitante que esgota seu limite não consome o teto global. Um visitante ainda pode esgotar a cota pública por uso indevido, então defina também cota e alertas de cobrança na conta Google antes de ativar a opção pública. Não há cobrança ou geração automática pelo Site Express: cada pedido requer clique no editor.

Sem credenciais e banco vinculados nesta máquina, os testes validam o contrato do endpoint com respostas simuladas. **Não houve geração real no Gemini nem teste em uma publicação da Lovable.** O código legado de contas não participa do fluxo público de imagens.
