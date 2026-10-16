# Validação da versão 1.0.6

## Resultado

- Teste de interface no Chromium: ativos agrupados, duas colunas com largura de 900 px, arraste real entre cards, reordenação pelo teclado, posição persistida após recarregar, ativação movendo para o grupo correto e layout de 360 px sem rolagem horizontal. Verificado que a ordem original de cálculo dos participantes permanece intacta. Teste reproduzível: `node tests/layout.test.cjs` com Playwright instalado.

- Quatro testes adicionais de recuperação: nada aplicado, redução compartilhada já aplicada, exclusão parcial concluída e bloqueio de quantidades/demandas incompatíveis.
- Integração da recuperação no Chromium: registro de versão anterior, botão no painel, recarregamento antes da prévia, nenhuma mutação durante revisão, somente dois itens pendentes removidos de um plano com três itens e encerramento de pendência concluída com zero chamadas de exclusão. Total: 30 testes unitários, além dos fluxos de navegador.

- Cinco testes adicionais do botão flutuante: exceção síncrona, rejeição assíncrona, runtime invalidado, resposta de erro do service worker e abertura normal/substituição do botão antigo.

- 21 testes de regras passaram em Node.js, incluindo milhares de combinações de distribuição de centavos.
- Regressão PTEN validada com 12 Swamp e R$ 11,76: título/alt, URL da bandeira, data-src e rótulo vizinho identificam PT/EN. Pedidos de idioma específico e preservação na remoção também testados.
- Tema escuro testado na interface: alternância claro/escuro, persistência após recarregar e inspeção visual do painel.
- Extensão Manifest V3 carregada em Chromium real, em perfil temporário isolado, com service worker e content scripts ativos.
- Fluxo da interface validado em página interceptada que reproduz o HTML de carrinho fornecido na conversa.
- XLSX exportado pela interface aberto com openpyxl: quatro abas, quantidades e valores pós-remoção corretos, filtros e cabeçalhos congelados.
- Painel inspecionado visualmente a 460 px e sem rolagem horizontal a 360 px.

## Remoção em lote — regressão 1.0.3

Teste com três exclusões individuais consecutivas, confirmação nativa em cada chamada e ocultação assíncrona das linhas; teste adicional com três exclusões e recarregamento completo entre itens. Verificados carrinho final vazio, nenhuma janela nativa de confirmação e restauração de window.confirm. Testes feitos em página controlada, sem compra real.

## Casos cobertos

Parsing de preços brasileiros; comentários, quantidades e idiomas das listas; nomes similares; cartas split; carta ausente; pedidos repetidos; conservação de quantidades e centavos; preferência por idioma explícito; idioma desconhecido; participante inativo; aliases bilíngues; versões ambíguas; quantidade insuficiente; dados inválidos; strings que parecem fórmulas na exportação.

Na integração do navegador: deduplicação de IDs do DOM; duplicatas conflitantes; prévia invalidada por alteração do carrinho; cancelamento sem efeito; redução de quantidade de carta compartilhada; exclusão individual; preservação da lista original e pausa do participante; token de uso único; persistência após recarregar o painel; histórico e exportação; erro no editor; conflito de revisão entre painéis; interrupção em falha da LigaMagic; registro da operação pendente e bloqueio de repetição.

## Limite da validação

Não houve execução em uma conta real da LigaMagic nem alteração de uma compra real. O servidor da LigaMagic e outros layouts não foram testados. O Edge não foi executado separadamente. Após instalar, confira as primeiras divisões e recarregue o site após remover itens para confirmar a persistência no servidor.

Os testes reproduzíveis estão na pasta `tests/`; instruções no README.


## v1.0.14 — busca de cartas em lojas LigaMagic

- Verificação de sintaxe de `store-search.js`, `panel.js` e `background.js`.
- Manifesto JSON válido.
- Busca automática agora é detectada pelos seletores comuns do e-commerce, não pelo domínio Cardvantage.
- Fallback opcional para nome impresso em português via Scryfall.
- A validação real em cada loja continua necessária porque lojas podem customizar o HTML e as rotas.


## Versão 1.0.24
- Adicionado botão de inclusão no carrinho diretamente no log lateral da loja quando a busca termina e a inclusão automática está desativada.
- O botão fica oculto durante a busca, quando a inclusão automática está ativada ou depois que a inclusão é processada.


## Versão 1.0.25
- Salva automaticamente a lista digitada, intervalo e opção de adição automática em `chrome.storage.local`, restaurando-os quando o popup é reaberto.
- Corrige a ordem de configuração do `onload` no iframe de produto para não perder carregamentos rápidos durante a inclusão no carrinho.
- O status de adição agora diferencia falha de solicitação e registra falhas por produto no log; não exibe mais “Inclusão solicitada” quando 0 itens foram processados com sucesso pela rotina.
- Verificações locais: sintaxe JavaScript e integridade do ZIP. A confirmação de inclusão real depende do site da loja e precisa ser conferida no carrinho.


## Versão 1.0.26
- Corrige a extração dos dois argumentos `tipo` e `id` da chamada nativa `item_comprar(tipo, id)`.
- Remove a dependência de localizar/chamar `item_comprar` dentro de um iframe oculto. A solicitação usa o endpoint de carrinho da própria origem e os cookies da sessão.
- Registra tentativas antes do envio para evitar reenvio automático duplicado quando a resposta é incerta.
- Não trata resposta HTTP como confirmação de item adicionado; exige conferência manual no carrinho.
- Validação estática: `node --check store-search.js` e integridade do ZIP. Não foi possível testar transação real na Cardvantage.
