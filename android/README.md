# Liga Divisor para Android

App independente, não oficial da LigaMagic. Android 8 ou superior.

## Instalação

O APK desta pasta foi instalado por USB no aparelho conectado e testado no Android 16. Para instalar novamente, abra Liga-Divisor-1.1.0.apk no celular e permita a instalação dessa origem quando solicitado. Atualize por cima para preservar os dados. Não desinstale sem exportar um backup.

## Novo: transferir o carrinho (app 1.1.0 / extensão 1.0.7)

1. No painel do aparelho de origem, abra **Transferir carrinho entre PC e celular** e escolha **Exportar carrinho (cookies)**.
2. Salve o JSON e transfira-o para seu outro aparelho (USB, por exemplo).
3. Abra a LigaMagic no destino, abra o divisor e escolha **Importar carrinho (cookies)**. Selecione o arquivo e confirme **Importar e recarregar**.
4. Confira os itens no site e use **Recalcular**. Para voltar do celular ao PC, siga os mesmos passos em sentido contrário.

O arquivo inclui apenas `carrinhoMP`, cookie utilizado por `mpAcoesXML` no código público do carrinho da LigaMagic. Não inclui sessão de login, senha, publicidade nem listas do divisor. A transferência não mescla carrinhos: substitui a referência local. Exporte o carrinho atual do destino se quiser preservá-lo antes da troca. Nenhuma compra é finalizada.

Mantenha o arquivo privado, pois ele pode permitir acesso ao carrinho. O arquivo não é criptografado. A validade do carrinho no servidor, sua associação a uma conta, estoque, preços e frete continuam sob controle da LigaMagic. A importação não garante que o servidor aceite uma referência expirada. Ela mantém o cookie local por até 30 dias; não prolonga a validade no servidor. Use o mesmo domínio na origem e no destino (`ligamagic.com.br` ou `ligamagic.com`). Cookies genéricos exportados por outros programas não são aceitos.

A extensão do PC passa a pedir a permissão `cookies`, limitada pelos domínios LigaMagic no manifesto. O código consulta e altera somente `carrinhoMP`. No Android, a ponte usa CookieManager apenas para esse nome e os dois domínios permitidos. Remoções pendentes bloqueiam a transferência até serem conferidas.

Validação: testes automatizados em Chromium da importação/exportação, confirmação/cancelamento, arquivos inválidos, domínios divergentes, escopos duplicados e preservação de cookie de login fictício. Teste entre extensão em perfil isolado e CookieManager do aparelho Android 16, nos dois sentidos, com referência fictícia e limpeza posterior. A recuperação de um carrinho real no servidor não foi testada, para não trocar o carrinho do usuário durante a validação.

## Uso

- O botão + cria outra aba na LigaMagic. As abas ficam na barra superior; × fecha uma aba. Limite: 12 abas do navegador.
- Entre na sua conta pelo próprio site. Carrinho abre o carrinho na aba selecionada.
- Toque em Dividir ou no botão flutuante do carrinho. O painel aparece sobre a página. Outra aba move o divisor para uma aba própria; Ampliar também abre esse modo.
- Adicione participantes e listas, com uma carta por linha: `2 Evolving Wilds [PT]`. Idioma é opcional. PTEN ou PT/EN indica lote misto. Comentários começam com #.
- Recalcular atualiza a leitura. Confira divergências e totais antes de usar os valores.
- Remover do carrinho exige a confirmação do plano no painel. A lógica usa remoções individuais e preserva quantidades atribuídas aos outros participantes. A lista removida é preservada e pausada. Em caso de interrupção, confira o registro e o carrinho antes de retomar.
- XLSX e backups abrem o seletor de salvamento do Android. Aguarde o aviso de arquivo salvo.
- Importar TXT / JSON abre o seletor de arquivos. Use Backup das listas na extensão do PC e importe esse JSON no app. Os dados do PC e do celular não são sincronizados automaticamente.
- O painel inclui tema escuro, histórico, diagnóstico recolhível e ordenação de participantes.
- Menu > Teste local abre um carrinho fictício para experimentar sem alterar compras reais.

## Dados e segurança

Listas e histórico ficam no armazenamento privado do app, com o mesmo contrato de dados usado pela extensão. Cookies ficam no navegador interno. O divisor reutiliza a lógica da extensão 1.0.7, adaptada ao Android; não depende de instalar uma extensão do Chrome no celular.

A ponte nativa é exposta apenas ao painel empacotado. Páginas externas não recebem essa ponte. Esta é uma compilação de desenvolvimento assinada para instalação direta, com depuração habilitada, não uma versão publicada em loja.

## Compilar no Windows

Requisitos: JDK 17, Android SDK platform 35, Build Tools 35.0.1 e chave de desenvolvimento em `%USERPROFILE%/.android/debug.keystore`.

Execute `./build.ps1` no PowerShell. Os parâmetros Sdk, Java e BuildTools permitem ajustar os caminhos. A chave privada não acompanha o projeto. Uma assinatura diferente não permite atualizar o APK instalado sem desinstalá-lo.

## Validação em 11/10/2026

No aparelho Android 16 conectado: instalação USB, carregamento real da LigaMagic, criação de abas, painel sobreposto, painel em outra aba, reabertura e persistência de listas. Em carrinho fictício executado no próprio aparelho: leitura de valores, conferência, redução de quantidade compartilhada e remoção individual. XLSX salvo pelo Android e validado como arquivo Office válido.

Não foram removidas cartas de uma compra real. Login e finalização de compra dependem da conta e não foram testados. Foram feitos também testes automatizados do adaptador no computador.

### Correção do fechamento ao abrir

O empacotamento anterior gravava separadores Windows nos caminhos internos dos arquivos do painel. O Android não encontrava `panel/core.js` e encerrava a Activity. O build agora inclui os assets com separadores `/` explícitos e o carregamento registra uma falha sem encerrar o navegador. A versão corrigida foi reinstalada e testada no aparelho.
