# Divisor de Listas — LigaMagic

**Extensão independente para Chrome e Microsoft Edge** que ajuda a organizar compras compartilhadas de Magic: The Gathering. Interface em português (Brasil), com dados locais no navegador.

**Desenvolvido por [Jessé Oliveira das Chagas](https://linktr.ee/Jessechagasdev).**

> Este é um projeto independente, sem vínculo oficial, patrocínio ou endosso da LigaMagic ou das lojas que utilizam sua plataforma. A compatibilidade pode variar conforme o site e suas atualizações.

## Recursos

- Separação de listas de cartas por participante.
- Conferência de quantidades, preços e divergências encontradas no carrinho.
- Simulação e divisão do frete por pessoa, valor ou quantidade.
- Exportação de planilhas XLSX, CSV, imagens e PDF, conforme o recurso utilizado.
- Histórico e backup local das listas.
- Busca de cartas em lojas compatíveis com o e-commerce LigaMagic, com registro dos resultados e links para abrir os produtos encontrados.
- Transferência do carrinho entre dispositivos usando o cookie específico do carrinho, quando disponível.
- Tema claro/escuro.

A extensão não finaliza compras. A busca em lojas é heurística e depende da estrutura do site; resultados, estoque, preço e disponibilidade devem ser confirmados na página da loja antes de comprar.

## Instalação no Chrome ou Edge

1. Baixe o ZIP deste repositório em **Releases** (ou use **Code → Download ZIP**).
2. Extraia o arquivo em uma pasta permanente do computador.
3. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
4. Ative **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta `ligamagic-divisor` extraída — a pasta que contém `manifest.json`.
6. Abra uma página compatível da LigaMagic e clique no ícone da extensão. Se preferir, abra o painel lateral pelo botão **Painel**.

Para atualizar, feche/atualize as páginas da loja e clique em **Recarregar** na página de extensões após substituir os arquivos pela nova versão.

## Tutorial de uso

### 1. Dividir uma compra entre participantes

1. Abra a página do carrinho da LigaMagic e abra a extensão.
2. Aguarde a leitura do carrinho. Use **Recalcular** se precisar atualizar os valores após alterações no site.
3. Clique em **+ Adicionar** para criar um participante.
4. Informe o nome e cole a lista: uma carta por linha, no formato `quantidade nome da carta`. Exemplo:

   ```text
   1 Sol Ring
   2 Arcane Signet
   1 Command Tower
   ```

5. Salve a lista e repita para cada participante. Revise os itens atribuídos e as divergências indicadas.
6. Em **Dividir frete**, escolha a regra de rateio: igualmente entre participantes com cartas, proporcional ao valor ou proporcional à quantidade.
7. Confira quantidades, subtotais, frete e total antes de tomar qualquer decisão no carrinho.

### 2. Buscar cartas em uma loja compatível (BETA)

> **Recurso experimental:** a consulta por loja funciona somente em lojas vinculadas à LigaMagic. Não é uma busca universal para qualquer loja virtual, e pode parar de funcionar se a loja alterar sua página.

1. Abra uma loja vinculada à plataforma LigaMagic em uma aba do navegador.
2. Dentro dessa loja, abra a página de produto de **qualquer carta**. Deixe essa página aberta; isso permite que a extensão reconheça o contexto da loja.
3. Abra a extensão e expanda a seção recolhida **“Beta · Buscar cartas em loja parceira da LigaMagic”**. Ela fica abaixo da área principal de divisão de listas, para não ocupar o início da interface.
4. Cole a lista no formato `quantidade nome`.
5. Defina o intervalo entre consultas. Mantenha um intervalo conservador; o padrão é 12 segundos. Não reduza o intervalo para pressionar o site.
6. Clique em **Buscar no site** e acompanhe o status e o log. A busca pode ser pausada e retomada quando disponível.
7. Ao concluir, clique em **Ver links das cartas disponíveis**. Abra cada produto pelo link e confira manualmente nome, edição, idioma, condição, preço e estoque.
8. Se o site responder com erro 403, apresentar um desafio ou bloquear as consultas, respeite o bloqueio e interrompa a busca. Não tente contornar mecanismos de segurança.

**Importante:** a extensão não adiciona automaticamente as cartas ao carrinho. “Disponível” significa que a busca identificou sinais de estoque na página; confirme sempre na loja. Ausência de resultado não prova que uma carta esteja esgotada.

### 3. Exportar, salvar e recuperar dados

- Use **Exportar XLSX** para obter uma planilha editável com a divisão.
- Use os recursos de imagem/PDF para compartilhar um resumo visual.
- **Salvar divisão no histórico** guarda um registro local da divisão atual.
- **Backup das listas** cria um arquivo para guardar ou restaurar suas listas.
- Os dados das listas são armazenados no navegador. Remover a extensão ou limpar os dados do navegador pode apagar informações locais; faça backups quando necessário.

### 4. Transferir o carrinho entre computador e celular

O recurso de transferência exporta o cookie específico do carrinho quando suportado. Esse arquivo pode permitir acesso ao carrinho enquanto o cookie for válido: trate-o como informação privada, não o publique nem envie a pessoas desconhecidas. O recurso não transfere as listas de participantes, não faz login e não finaliza a compra. Confira o domínio e o carrinho antes de importar.

## Privacidade e segurança

- As listas e o histórico são armazenados localmente pelo navegador.
- A extensão precisa de permissões para ler a página compatível, manter dados locais e executar recursos de interface.
- A busca consulta páginas da loja e pode usar o serviço Scryfall para tentar encontrar nomes impressos em português, quando esse fallback for acionado.
- O recurso de transferência do carrinho manipula um cookie de sessão específico. Nunca compartilhe esse arquivo publicamente.
- Não inclua dados pessoais, cookies, capturas de tela privadas ou arquivos de sessão ao abrir uma issue.

Veja [SECURITY.md](SECURITY.md) para reportar vulnerabilidades com responsabilidade.

## Desenvolvimento e testes

O código-fonte está na raiz da pasta da extensão. Os testes reproduzíveis estão em `tests/` e usam Node.js; alguns testes de navegador podem exigir dependências adicionais, conforme descrito no próprio teste.

Verificações básicas:

```bash
node --check panel.js
node --check background.js
node --check store-search.js
node --check core.js
```

Valide também se `manifest.json` é JSON válido e carregue a extensão em um perfil de teste do Chrome/Edge. Os testes locais não substituem a conferência manual no site: não execute testes com compras reais ou carrinhos importantes.

## Limitações conhecidas

- A estrutura e os seletores do site podem mudar sem aviso e quebrar a leitura.
- Preços, idioma, condição, estoque e correspondência de nomes são extraídos por regras heurísticas; confira-os manualmente.
- Não há garantia de compatibilidade com todas as lojas, navegadores ou versões do site.
- O projeto não faz checkout nem confirma compras.
- O projeto é mantido de forma independente; não há garantia de suporte oficial.

## Como contribuir

Sugestões e correções são bem-vindas. Antes de abrir uma issue, procure duplicatas e descreva os passos para reproduzir o problema, o navegador e a versão da extensão. Não inclua cookies, credenciais ou dados pessoais. Leia [CONTRIBUTING.md](CONTRIBUTING.md).

## Direitos autorais e licença

Copyright (c) 2026 **Jessé Oliveira das Chagas**. Consulte o arquivo [LICENSE](LICENSE) para os termos de uso, cópia, modificação e distribuição.

O nome LigaMagic e as marcas relacionadas pertencem aos respectivos titulares. Seu uso neste repositório serve apenas para identificar a plataforma com a qual a extensão tenta ser compatível; não implica afiliação ou endosso.

---

Desenvolvido por **Jessé Oliveira das Chagas** · [Linktree](https://linktr.ee/Jessechagasdev)


## Tutorial rápido

1. Abra o carrinho da LigaMagic e clique em **Recalcular** para ler os valores atuais.
2. Clique em **+ Adicionar**, dê um nome ao participante e cole uma carta por linha como `2 Sol Ring`.
3. Repita para cada participante e confira os totais e a seção **Divergências**.
4. Escolha como dividir o frete e use **Imagem do resumo geral**, **Exportar XLSX** ou **Salvar divisão no histórico** conforme necessário.
5. Use **Backup das listas** para guardar seus dados.
6. Clique em **Ajuda** dentro da extensão para abrir o manual completo ou iniciar novamente o tutorial guiado.

### Busca de cartas em lojas (BETA)

A consulta de produtos é **experimental** e funciona somente em lojas vinculadas à LigaMagic que sejam compatíveis. Para usar: (1) abra uma loja afiliada à LigaMagic; (2) entre na página de qualquer carta nessa loja; (3) abra a seção **Beta · Buscar cartas em loja parceira da LigaMagic** na extensão; (4) cole ou carregue uma lista salva e clique em **Buscar no site**; (5) ao concluir, clique em **Ver links das cartas disponíveis**. Confirme no site o nome, edição, idioma, condição, preço e estoque. A extensão não adiciona cartas ao carrinho. Se ocorrer erro 403 ou desafio de segurança, pare a consulta e respeite o bloqueio.
