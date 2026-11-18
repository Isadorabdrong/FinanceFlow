export type TransactionType = "income" | "expense";
export type PeriodFilter = "all" | "this-month" | "last-3-months" | "this-year";
export type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
};
export type TransactionForm = Omit<Transaction, "id" | "amount"> & {
  amount: string;
};
export type Filters = {
  type: "all" | TransactionType;
  category: string;
  period: PeriodFilter;
  search: string;
};
export const STORAGE_KEY = "finance-flow-transactions-v1";
export const PROFILE_KEY = "finance-flow-profile-v1";
export const DEMO_KEY = "finance-flow-demo-v1";
export const categories = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Lazer",
  "Saúde",
  "Educação",
  "Salário",
  "Freelance",
];
export const emptyFilters: Filters = {
  type: "all",
  category: "all",
  period: "all",
  search: "",
};
export const MAX_AMOUNT = 999_999_999.99;

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00`);
  return (
    Number.isFinite(date.getTime()) &&
    localDate(date) === value &&
    date.getFullYear() >= 1900 &&
    date.getFullYear() <= 2100
  );
}
export function parseAmount(value: string) {
  const input = value.trim().replace(/^R\$\s*/, "");
  let normalized: string;
  if (input.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(input)) return NaN;
    normalized = input.replaceAll(".", "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(input)) {
    normalized = input.replaceAll(".", "");
  } else {
    if (!/^\d+(?:\.\d{1,2})?$/.test(input)) return NaN;
    normalized = input;
  }
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 && number <= MAX_AMOUNT
    ? Math.round(number * 100) / 100
    : NaN;
}
export function validateTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) throw new Error("Formato de dados inválido.");
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object")
      throw new Error("Lançamento inválido.");
    const t = item as Transaction;
    if (
      typeof t.id !== "string" ||
      !t.id ||
      ids.has(t.id) ||
      typeof t.description !== "string" ||
      !t.description.trim() ||
      typeof t.amount !== "number" ||
      !Number.isFinite(t.amount) ||
      t.amount <= 0 ||
      t.amount > MAX_AMOUNT ||
      !["income", "expense"].includes(t.type) ||
      typeof t.category !== "string" ||
      !t.category.trim() ||
      !isValidDate(t.date)
    )
      throw new Error("Há um lançamento inválido nos dados salvos.");
    ids.add(t.id);
    return {
      id: t.id,
      description: t.description,
      amount: Math.round(t.amount * 100) / 100,
      type: t.type,
      category: t.category,
      date: t.date,
    };
  });
}
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
export function formatMoney(value: number) {
  return money.format(value).replaceAll("\u00a0", " ");
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(`${value}T12:00:00`))
    .replace(".", "");
}
export function sumTransactions(items: Transaction[]) {
  // Sum integer cents so repeated decimal amounts never drift in the UI or CSV.
  let incomeCents = 0,
    expenseCents = 0;
  for (const item of items) {
    if (item.type === "income") incomeCents += Math.round(item.amount * 100);
    else expenseCents += Math.round(item.amount * 100);
  }
  return {
    income: incomeCents / 100,
    expenses: expenseCents / 100,
    balance: (incomeCents - expenseCents) / 100,
    savingsRate: incomeCents
      ? Math.round(((incomeCents - expenseCents) / incomeCents) * 100)
      : null,
  };
}
export function inPeriod(
  items: Transaction[],
  period: PeriodFilter,
  now = new Date(),
) {
  if (period === "all") return items;
  const start = new Date(
    now.getFullYear(),
    period === "this-year"
      ? 0
      : now.getMonth() - (period === "last-3-months" ? 2 : 0),
    1,
  );
  const from = localDate(start),
    to = localDate(now);
  return items.filter((item) => item.date >= from && item.date <= to);
}
export function filterTransactions(
  items: Transaction[],
  filters: Filters,
  now = new Date(),
) {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const search = normalize(filters.search.trim());
  return inPeriod(items, filters.period, now)
    .filter((item) => filters.type === "all" || item.type === filters.type)
    .filter(
      (item) =>
        filters.category === "all" || item.category === filters.category,
    )
    .filter((item) =>
      normalize(`${item.description} ${item.category}`).includes(search),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function monthlySeries(
  items: Transaction[],
  count: number,
  now = new Date(),
) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + i + 1, 1);
    const key = localDate(date).slice(0, 7);
    const totals = sumTransactions(
      items.filter(
        (item) => item.date.startsWith(key) && item.date <= localDate(now),
      ),
    );
    return {
      month: new Intl.DateTimeFormat("pt-BR", { month: "short" })
        .format(date)
        .replace(".", ""),
      label: new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
      }).format(date),
      key,
      ...totals,
    };
  });
}
// Quantos meses o gráfico mostra para cada período escolhido no filtro.
// Assim o gráfico obedece ao mesmo filtro dos totais.
export function monthsInPeriod(
  items: Transaction[],
  period: PeriodFilter,
  now = new Date(),
) {
  if (period === "this-month") return 1;
  if (period === "last-3-months") return 3;
  if (period === "this-year") return now.getMonth() + 1;
  if (!items.length) return 6;
  const first = items.reduce((min, t) => (t.date < min ? t.date : min), items[0].date);
  const [y, m] = first.split("-").map(Number);
  const span = (now.getFullYear() - y) * 12 + now.getMonth() + 1 - m + 1;
  return Math.min(12, Math.max(1, span));
}
export function expenseCategories(items: Transaction[]) {
  const grouped = new Map<string, number>();
  for (const item of items)
    if (item.type === "expense")
      grouped.set(
        item.category,
        (grouped.get(item.category) || 0) + Math.round(item.amount * 100),
      );
  return [...grouped.entries()]
    .map(([name, cents]) => ({ name, value: cents / 100 }))
    .sort((a, b) => b.value - a.value);
}
export function toCsv(items: Transaction[]) {
  const cell = (s: string) =>
    `"${(/^[\s]*[=+\-@\t\r\n]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`;
  const rows = items.map((t) =>
    [
      t.date,
      t.description,
      t.type === "income" ? "Entrada" : "Saída",
      t.category,
      t.amount.toFixed(2).replace(".", ","),
    ]
      .map(cell)
      .join(";"),
  );
  return (
    "\uFEFF" +
    ["Data;Descrição;Tipo;Categoria;Valor (R$)", ...rows].join("\r\n")
  );
}
export function makeStarterData(now = new Date()): Transaction[] {
  const records: Array<
    [number, number, string, number, TransactionType, string]
  > = [
    [0, 1, "Salário mensal", 8420, "income", "Salário"],
    [0, 1, "Aluguel do apartamento", 2350, "expense", "Moradia"],
    [0, 2, "Mercado do mês", 684.72, "expense", "Alimentação"],
    [0, 2, "Passe mensal", 220, "expense", "Transporte"],
    [1, 5, "Salário mensal", 8420, "income", "Salário"],
    [1, 8, "Projeto de identidade visual", 1250, "income", "Freelance"],
    [1, 5, "Aluguel do apartamento", 2350, "expense", "Moradia"],
    [1, 10, "Compras do mês", 870.4, "expense", "Alimentação"],
    [1, 18, "Consulta dermatológica", 280, "expense", "Saúde"],
    [1, 23, "Cinema com amigos", 96, "expense", "Lazer"],
    [2, 5, "Salário mensal", 7900, "income", "Salário"],
    [2, 5, "Aluguel do apartamento", 2350, "expense", "Moradia"],
    [2, 12, "Mercado", 790.5, "expense", "Alimentação"],
    [2, 16, "Curso de programação", 349, "expense", "Educação"],
    [3, 5, "Salário mensal", 7900, "income", "Salário"],
    [3, 7, "Aluguel do apartamento", 2350, "expense", "Moradia"],
    [3, 12, "Mercado", 915.8, "expense", "Alimentação"],
    [3, 20, "Viagem de fim de semana", 920, "expense", "Lazer"],
    [4, 5, "Salário mensal", 7900, "income", "Salário"],
    [4, 6, "Aluguel do apartamento", 2350, "expense", "Moradia"],
    [4, 12, "Mercado", 810.25, "expense", "Alimentação"],
    [5, 5, "Salário mensal", 7500, "income", "Salário"],
    [5, 7, "Aluguel do apartamento", 2350, "expense", "Moradia"],
    [5, 10, "Mercado", 740.7, "expense", "Alimentação"],
  ];
  return records.map(
    ([offset, day, description, amount, type, category], i) => ({
      id: `starter-${i + 1}`,
      description,
      amount,
      type,
      category,
      date: localDate(
        new Date(
          now.getFullYear(),
          now.getMonth() - offset,
          offset === 0 ? Math.min(day, now.getDate()) : day,
        ),
      ),
    }),
  );
}
