# Validação da versão 2.0

## Testes automatizados

- 13 testes TypeScript aprovados: valores em reais, datas, centavos, períodos, meses vazios, categorias, busca, validação dos dados, CSV, pares monetários, preços e timestamps das fontes.
- 20 testes Python aprovados: CRUD, persistência após recriar a aplicação, entradas inválidas, totais exatos, filtros por data, registros ausentes, consultas parametrizadas, cache da fonte, falha externa sem cotação inventada, restrição de Host e ativação explícita do modo API sem alterar o arquivo independente.
- TypeScript e build de produção aprovados.

## Navegador

- Abertura real do HTML por `file://`, sem servidor, e funcionamento offline.
- Reproduzido e corrigido o erro da prévia HTTP estática: o build anterior tentava acessar `/api/transactions` e falhava com 404. O arquivo corrigido abre por `file://` e por HTTP estático, carrega exemplos na primeira abertura, preserva registros e listas vazias após recarregar e não solicita `/api` em nenhum desses dois modos.
- Cadastro, edição, exclusão com confirmação, CSV e persistência após recarregar.
- Painel e Movimentações exibidos separadamente.
- Perfil restaurado com a chave anterior: nome e iniciais do avatar, edição, persistência após recarregar, rejeição de nome vazio e aviso quando o navegador impede salvar. A edição do perfil não altera os lançamentos.
- Perfil acessível na barra lateral e no topo do celular; diálogo verificado com Tab, Shift+Tab, Escape e retorno do foco.
- Cotações posicionadas antes do resumo e da lista de lançamentos, nas duas telas. Larguras de 320, 390, 680, 768, 1024 e 1440 px verificadas; novos elementos com contraste mínimo de 4,5:1.
- Navegação móvel e larguras de 320, 390, 768, 1024 e 1440 px sem rolagem horizontal.
- Relógio com segundos e troca da data à meia-noite em Brasília, verificados com relógio de teste.
- Tab contido no diálogo, Escape e retorno de foco.
- Contraste dos textos visíveis conferido pelos estilos calculados no navegador.
- Interface HTTP integrada ao FastAPI real: cadastro, edição, exclusão e persistência no SQLite, sem usar LocalStorage nesse modo.
- Após a correção do modo de abertura, cadastro e recarga pela interface FastAPI novamente verificados com SQLite real. Cotações reais de Bitcoin, dólar e euro também chegaram ao app servido por HTTP estático; timestamps antigos continuaram indicados como “Sem atualização recente”.

## Fontes externas

Atualização do Bitcoin, expiração de “Ao vivo”, consulta automática de 60 segundos, resposta parcial, indisponibilidade e espera entre tentativas foram testadas com respostas controladas **somente no navegador de teste**. O produto não contém preços simulados nem atualização artificial de timestamps.

A consulta HTTPS real à AwesomeAPI respondeu com Bitcoin, dólar e euro. A fonte retornou `Access-Control-Allow-Origin: *`, e uma consulta real dentro do navegador aberto por `file://` recebeu HTTP 200 e os três pares. O primeiro pedido excedeu o limite anterior de oito segundos; a espera foi ampliada para 20 segundos no cliente e 12 no proxy Python. Após o ajuste, o próprio aplicativo aberto por `file://` recebeu HTTP 200 e exibiu os três preços reais, mantendo dólar e euro identificados com o horário anterior da fonte. A infraestrutura de testes usa um proxy com certificado próprio; a exceção de certificado foi restrita ao navegador de teste, sem alteração no produto.

O endpoint REST de verificação da Binance respondeu HTTP 451 neste ambiente. A integração do stream foi validada com mensagens controladas; a disponibilidade real depende da fonte e da região. Se o stream não responder, a interface retira “Ao vivo” e pode exibir a cotação disponível da AwesomeAPI, identificada como consulta periódica.

As imagens em `preview` mostram lançamentos de exemplo e cotações recebidas da fonte durante a captura, com os horários publicados por ela. Valores antigos aparecem com o aviso de falta de atualização recente. O banco SQLite da aplicação não acompanha dados de teste.

O pacote inclui `Finance-Flow.html` na pasta principal e uma cópia idêntica em `portable`. O HTML entregue separadamente contém os mesmos bytes. O arquivo inclui CSS, ícones e JavaScript para abertura direta; o código editável, API Python, testes e documentação também acompanham o ZIP.
