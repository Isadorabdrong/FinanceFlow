import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAmount,
  validateTransactions,
  sumTransactions,
  monthlySeries,
  inPeriod,
  expenseCategories,
  filterTransactions,
  emptyFilters,
  toCsv,
  isValidDate,
  localDate,
  type Transaction,
} from "../src/lib/finance.ts";
const item = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "one",
  description: "Café",
  amount: 10,
  type: "expense",
  date: "2026-03-01",
  category: "Alimentação",
  ...overrides,
});

test("aceita reais com vírgula, milhar e valor decimal legado", () => {
  for (const [value, expected] of [
    ["1.250,50", 1250.5],
    ["1250,50", 1250.5],
    ["1.250", 1250],
    ["1250.50", 1250.5],
    ["R$ 0,01", 0.01],
  ] as const)
    assert.equal(parseAmount(value), expected);
  for (const invalid of [
    "Infinity",
    "1e4",
    "0",
    "-10",
    "1,234",
    "1.2.3",
    "1,2,3",
    "9999999999",
  ])
    assert.ok(Number.isNaN(parseAmount(invalid)), invalid);
});
test("valida a data real sem normalizar dias inexistentes", () => {
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(localDate(new Date(2026, 9, 3, 23, 59)), "2026-10-03");
});
test("soma em centavos sem erro de ponto flutuante", () => {
  const total = sumTransactions([
    item({ amount: 0.1, type: "income" }),
    item({ amount: 0.2, type: "income" }),
    item({ amount: 0.3 }),
  ]);
  assert.equal(total.income, 0.3);
  assert.equal(total.balance, 0);
  assert.equal(sumTransactions([item()]).savingsRate, null);
});
test("não perde o primeiro dia do mês e exclui datas futuras do período", () => {
  const now = new Date(2026, 2, 31, 20);
  const data = [
    item({ id: "1", date: "2026-03-01" }),
    item({ id: "2", date: "2026-01-01" }),
    item({ id: "3", date: "2025-12-31" }),
    item({ id: "4", date: "2026-04-01" }),
  ];
  assert.deepEqual(
    inPeriod(data, "this-month", now).map((t) => t.id),
    ["1"],
  );
  assert.deepEqual(
    inPeriod(data, "last-3-months", now).map((t) => t.id),
    ["1", "2"],
  );
});
test("preenche meses vazios e mantém o intervalo correto na virada do ano", () => {
  const data = monthlySeries(
    [item({ date: "2025-12-01", amount: 12 })],
    3,
    new Date(2026, 1, 28),
  );
  assert.deepEqual(
    data.map((m) => m.key),
    ["2025-12", "2026-01", "2026-02"],
  );
  assert.deepEqual(
    data.map((m) => m.expenses),
    [12, 0, 0],
  );
});
test("inclui todas as categorias no total", () => {
  const data = Array.from({ length: 8 }, (_, i) =>
    item({ id: String(i), category: `Categoria ${i}`, amount: i + 1 }),
  );
  const groups = expenseCategories(data);
  assert.equal(groups.length, 8);
  assert.equal(
    groups.reduce((n, c) => n + c.value, 0),
    36,
  );
});
test("busca ignora acentos e combina filtros", () => {
  assert.equal(
    filterTransactions([item()], { ...emptyFilters, search: " CAFE " }).length,
    1,
  );
  assert.equal(
    filterTransactions([item()], {
      ...emptyFilters,
      search: "cafe",
      type: "income",
    }).length,
    0,
  );
});
test("recusa dados corrompidos e ids duplicados sem mudar a entrada", () => {
  const input = [item()];
  assert.deepEqual(validateTransactions(input), input);
  for (const data of [
    [item({ amount: Infinity })],
    [item({ date: "2026-02-30" })],
    [item(), item()],
    [{ id: "invalid" }],
    {},
  ])
    assert.throws(() => validateTransactions(data));
  assert.deepEqual(input, [item()]);
});
test("CSV usa valores brasileiros, escapa aspas e neutraliza fórmulas", () => {
  const csv = toCsv([
    item({ description: '=HYPERLINK("example")', amount: 1250.5 }),
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"1250,50"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""example"")"'));
  assert.ok(toCsv([]).includes("Descrição"));
});
