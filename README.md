# Finance Flow

Controle financeiro com duas telas: **Painel** e **Movimentações**. Interface em rosé e ameixa, com perfil, avatar e saudação pessoal. Bitcoin, dólar e euro aparecem logo abaixo do título, antes do resumo financeiro e dos lançamentos. A data e o relógio no cabeçalho usam o horário de Brasília. Sem frases de marketing, sombras, desfoques ou animações decorativas.

## Abrir sem instalar

Dê dois cliques em **`Finance-Flow.html`**, na pasta principal do ZIP extraído. O aplicativo abre no navegador, sem npm, Node.js, terminal ou servidor. Cadastro, edição, exclusão, filtros, perfil e CSV funcionam sem internet. As cotações precisam de conexão. A cópia em `portable/Finance-Flow.html` é idêntica e continua incluída para compatibilidade com o backend.

O arquivo HTML contém o aplicativo compilado. O código legível, os testes e a API Python também estão neste projeto; o HTML minificado não é o material destinado à revisão de código.

## Dois modos de uso

| Modo | Como abrir | Onde salva |
| --- | --- | --- |
| Arquivo independente | `Finance-Flow.html` na pasta principal | LocalStorage do navegador |
| Aplicação com API | `http://127.0.0.1:8000` com o backend iniciado | SQLite, por meio da API FastAPI |

O HTML independente utiliza o armazenamento do navegador tanto ao abrir por `file://` quanto em uma hospedagem estática. O modo API só é ativado explicitamente pelo servidor Python ou pela entrada de desenvolvimento do Vite, por meio da meta `finance-flow-mode`. Assim, abrir uma prévia HTTP do arquivo não causa pedidos a um backend inexistente. A API não recebe nem importa automaticamente os lançamentos do HTML. O banco começa vazio; os exemplos são exclusivos da primeira abertura do arquivo independente. Falha da API não provoca troca silenciosa para outro armazenamento.

## Versão Python para desenvolvimento e portfólio

Requisitos: Python 3.11 ou superior. Na raiz do projeto, em um ambiente virtual de sua preferência:

```bash
python -m pip install -r backend/requirements-dev.txt
python -m backend
```

Abra `http://127.0.0.1:8000`. A API serve o HTML já incluído em `portable`; não é preciso compilar o frontend para usar esse modo. A documentação interativa dos endpoints está em `http://127.0.0.1:8000/docs`.

O SQLite fica em `backend/data/finance-flow.sqlite3`. A variável `FINANCE_FLOW_DB` permite escolher outro caminho; `API_PORT` altera a porta. O servidor escuta apenas em `127.0.0.1`. Esta versão é local e individual: não inclui autenticação, contas bancárias conectadas ou sincronização em nuvem.

## Estrutura e decisões

- `artifacts/finance-flow/src/App.tsx`: as duas telas, filtros, gráficos e formulário.
- `src/components/modal.tsx`: `<dialog>` nativo, foco contido, Escape e retorno de foco.
- `src/components/profile.tsx`: perfil editável, iniciais do avatar e compatibilidade com o nome salvo na versão anterior.
- `src/lib/runtime.ts`: lê o modo de execução declarado no HTML; não presume que HTTP significa servidor Python.
- `src/hooks/use-ledger.ts`: escolhe a persistência pelo modo declarado e aguarda confirmação da API antes de atualizar a interface.
- `src/lib/finance.ts`: valores brasileiros, datas, totais em centavos, períodos e CSV.
- `src/hooks/use-market.ts`: consulta automática, conexão Bitcoin, reconexão e preservação de valores recebidos.
- `src/lib/market.ts`: valida preço, moeda e horário da fonte; não inventa cotação ausente.
- `backend/models.py`: validação das entradas e respostas com Pydantic.
- `backend/database.py`: consultas SQL parametrizadas, transações e índice por data.
- `backend/app.py`: endpoints FastAPI, inicialização do banco e entrega da interface.
- `backend/market.py`: consulta de cotações no servidor, com cache de 60 segundos e origem externa fixa.
- `backend/tests`: testes da API com bancos temporários e fontes externas simuladas.
- `tests`: testes das regras financeiras e da validação de cotações.

Os caminhos abreviados `src/` acima pertencem a `artifacts/finance-flow/`.

Valores na API e no SQLite são **centavos inteiros** (`amount_cents`). O frontend converte para reais somente para exibição. Datas são datas civis; timestamps das cotações são exibidos em Brasília. Os endpoints de lista e resumo aceitam `start` e `end`. SQLite foi escolhido para permitir inspeção do banco e execução local sem outro serviço; uma aplicação multiusuário exigiria autenticação e isolamento por usuário.

## Endpoints

| Método | Caminho | Finalidade |
| --- | --- | --- |
| GET | `/api/health` | Estado do serviço |
| GET | `/api/transactions` | Listar movimentações, com período opcional |
| POST | `/api/transactions` | Cadastrar |
| PUT | `/api/transactions/{id}` | Atualizar |
| DELETE | `/api/transactions/{id}` | Excluir |
| GET | `/api/summary` | Entradas, despesas e saldo em centavos |
| GET | `/api/market/quotes` | Consultar Bitcoin, dólar e euro |

## Cotações

Bitcoin usa o stream público `BTCBRL` da Binance. “Ao vivo” só aparece depois de uma mensagem válida e recente; após 15 segundos sem atualização, a indicação é retirada. Havendo falha do stream, uma cotação disponível da AwesomeAPI pode ser usada, com a atualização de 60 segundos claramente identificada.

Dólar e euro usam o preço de compra da AwesomeAPI, consultado a cada 60 segundos enquanto a página está visível. A modalidade gratuita da fonte mantém cache de até um minuto: não equivale a uma cotação instantânea de corretora. Em fins de semana e feriados, o horário da fonte pode continuar no último dia disponível. Um pedido novo não altera artificialmente esse horário.

No HTML independente, a consulta HTTPS é feita pelo navegador e depende das regras de origem da fonte e da conexão. Na versão FastAPI, o navegador consulta a própria origem e o servidor faz a requisição externa, eliminando a dependência de CORS dessa consulta. Em ambos os modos, valores antigos são identificados e falhas de mercado não impedem os lançamentos.

Documentação das fontes: [AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas) e [Binance](https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams).

## Testes e alteração do frontend

```bash
python -m pytest backend/tests -q
```

Para editar e reconstruir o frontend, apenas desenvolvedores precisam de Node.js 22.18+ e pnpm 11.25.0:

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

`pnpm dev` inicia Vite e FastAPI, e requer as dependências Python instaladas. Em ambientes virtuais fora do PATH, `FINANCE_FLOW_PYTHON` permite informar o executável Python. `pnpm build` verifica TypeScript e recria o HTML independente. O CSS é próprio, com raios de 6 e 8 px e círculos nos avatares, ícones das moedas e indicadores; os componentes gerados sem uso e a API Express anterior foram removidos.

## Dados locais e exportação

O HTML mantém as chaves `finance-flow-transactions-v1` e `finance-flow-profile-v1`. O perfil fica no navegador também no modo API. Usar outro navegador, mudar a origem ou mover o arquivo pode abrir um armazenamento diferente; preserve o mesmo local e exporte CSV para cópia. Limpar os dados do navegador pode apagar registros. O HTML baixado não contém seus lançamentos pessoais.

O CSV inclui todos os resultados filtrados, não apenas a página visível. Usa UTF-8 com BOM, separador `;`, vírgula decimal e neutralização de campos que poderiam ser interpretados como fórmulas.

Veja `VALIDACAO.md` para os testes realizados e as limitações verificadas.
