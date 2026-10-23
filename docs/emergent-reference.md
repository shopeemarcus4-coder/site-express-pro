# Referência Emergent para o Site Express

Fonte: `emergent ai.zip` enviado pelo usuário em 23/10/2026. A árvore React completa foi recuperada do histórico Git incluído no arquivo, complementado pelos objetos Git do `EMERGENT_ORIGINAL.zip` já fornecido. Nenhum script, backend ou arquivo `.env` do material foi executado ou copiado para o aplicativo.

O REA 6.7.0 analisou estaticamente os 74 arquivos do frontend em `frontend/src`. Evidência `ev_88878818c57b4e849ec193cf2f080a2cca762d6374481e935be99157a06703c0`, digest da árvore `b5abb72f98c54cbf35ad6c6efba4d0735b7ae9ac3a16d84b571a2e1d375b218a`. A análise comprova a estrutura do código, mas não a aparência renderizada nem o funcionamento de serviços externos.

| Fluxo observado no código enviado           | Arquivos da referência                                     | Equivalente no projeto                                                          |
| ------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Busca da empresa e escolha do resultado     | `components/SearchHome.jsx`, `pages/Studio.jsx`            | Busca na tela inicial de `/app`, com revisão dos dados no formulário de criação |
| Modelos de gastronomia, serviços e produtos | `components/GmbModal.jsx`, `lib/sitegen/projectFactory.js` | Três modelos selecionáveis, sem preços ou avaliações inventadas                 |
| Gestão de sites e suspensão                 | `components/ClientsPanel.jsx`                              | Cartões de projetos, duplicação, exclusão e controle de publicação para contas  |
| Edição, prévia e exportação                 | `components/Editor.jsx`                                    | Editor React existente, prévia, HTML e ZIP                                      |
| Título e descrição para buscas              | `components/MarketingPanel.jsx`                            | Aba SEO no editor, aplicada à página publicada e ao HTML exportado              |
| Contratos                                   | Ausente na referência                                      | Mantido no Site Express                                                         |

Limites da comparação: o MP4 enviado excedeu o limite de transferência de 32 MiB deste ambiente; a URL de prévia retornou HTTP 403 no proxy. O PDF dentro do ZIP registra uma captura do site Lovable, não da interface Emergent. Portanto a fidelidade visual só pode ser conferida após acesso à prévia ou a um vídeo menor. O Chromium deste ambiente também não conseguiu concluir uma captura de tela local; build, tipos, lint e testes são as verificações disponíveis aqui.

Diferenças intencionais por precisão dos dados: a referência usa demonstrações e textos com preços, contagens de avaliações e selo de verificação que não decorrem necessariamente de dados verificados. O Site Express não publica essas afirmações automaticamente. A configuração de IA paga da referência também não foi importada.
