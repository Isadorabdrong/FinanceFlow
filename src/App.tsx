import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { AuthScreen, NewPasswordScreen } from "./components/auth-screen";
import { HeaderClock } from "./components/header-clock";
import { MarketCard } from "./components/market-card";
import { Modal } from "./components/modal";
import { MonthlyChart } from "./components/monthly-chart";
import { ProfileButton, ProfileModal } from "./components/profile";
import { useAuth } from "./hooks/use-auth";
import { useLedger } from "./hooks/use-ledger";
import {
  type Filters,
  type PeriodFilter,
  type Transaction,
  type TransactionForm,
  categories,
  emptyFilters,
  expenseCategories,
  filterTransactions,
  formatDate,
  formatMoney,
  inPeriod,
  isValidDate,
  localDate,
  monthlySeries,
  monthsInPeriod,
  parseAmount,
  sumTransactions,
  toCsv,
} from "./lib/finance";

type Section = "overview" | "transactions";

const periodLabels: Record<PeriodFilter, string> = {
  all: "Todo o período",
  "this-month": "Este mês",
  "last-3-months": "Últimos 3 meses",
  "this-year": "Este ano",
};
const PAGE_SIZE = 10;
const GITHUB_URL = "https://github.com/Isadorabdrong/FinanceFlow";


function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const auth = useAuth();
  if (!auth.ready) return <div className="loading">Carregando…</div>;
  if (auth.recovering) return <NewPasswordScreen onDone={auth.doneRecovering} />;
  if (!auth.user) return <AuthScreen />;
  return <Dashboard auth={auth} userId={auth.user.id} />;
}

function Dashboard({ auth, userId }: { auth: ReturnType<typeof useAuth>; userId: string }) {
  const ledger = useLedger(userId);
  const { transactions, isLoading, loadError, saveError, pending } = ledger;
  const [section, setSection] = useState<Section>("overview");
  const [modal, setModal] = useState<"form" | "delete" | "profile" | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => setPage(1), [filters]);

  // O período escolhido no Painel vale para tudo: totais, gráfico, categorias e lista.
  const periodItems = useMemo(() => inPeriod(transactions, period), [transactions, period]);
  const totals = useMemo(() => sumTransactions(periodItems), [periodItems]);
  const monthly = useMemo(
    () => monthlySeries(transactions, monthsInPeriod(transactions, period)),
    [transactions, period],
  );
  const byCategory = useMemo(() => expenseCategories(periodItems), [periodItems]);
  const latest = useMemo(
    () => [...periodItems].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [periodItems],
  );

  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const filteredTotals = useMemo(() => sumTransactions(filtered), [filtered]);
  const allCategories = useMemo(
    () => [...new Set([...categories, ...transactions.map((t) => t.category)])],
    [transactions],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = (Object.keys(emptyFilters) as (keyof Filters)[]).some(
    (key) => filters[key] !== emptyFilters[key],
  );
  const countOf = (type: Transaction["type"]) => periodItems.filter((t) => t.type === type).length;

  function goTo(next: Section) {
    setSection(next);
    window.scrollTo({ top: 0 });
    window.requestAnimationFrame(() => document.getElementById("page-title")?.focus());
  }
  function openForm(transaction?: Transaction) {
    setEditing(transaction || null);
    setModal("form");
  }
  function askDelete(transaction: Transaction) {
    setDeleting(transaction);
    setModal("delete");
  }
  function closeModal() {
    setModal(null);
    setEditing(null);
    setDeleting(null);
  }
  async function saveTransaction(form: TransactionForm) {
    const amount = parseAmount(form.amount);
    if (!Number.isFinite(amount)) return;
    const ok = await ledger.save({ ...form, amount, id: editing?.id || "" }, Boolean(editing));
    if (ok) {
      setNotice(editing ? "Lançamento atualizado." : "Lançamento adicionado.");
      closeModal();
    }
  }
  function exportCsv() {
    download(toCsv(filtered), `finance-flow-${localDate()}.csv`, "text/csv;charset=utf-8;");
    setNotice(`${filtered.length} lançamentos exportados.`);
  }
  function backup() {
    download(JSON.stringify(transactions, null, 2), `finance-flow-backup-${localDate()}.json`, "application/json");
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button className="wordmark" onClick={() => goTo("overview")} aria-label="Finance Flow, ir para o painel">
            <span className="brand-mark" aria-hidden="true">
              f
            </span>
            <span className="brand-word">finance flow</span>
          </button>
          <nav className="tabs" aria-label="Seções">
            {(
              [
                ["overview", "Painel"],
                ["transactions", "Movimentações"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className="tab"
                aria-current={section === id ? "page" : undefined}
                onClick={() => goTo(id)}
                data-testid={`nav-${id}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="header-tools">
            <HeaderClock />
            <ProfileButton name={auth.name} onEdit={() => setModal("profile")} />
            <button className="button primary" onClick={() => openForm()} data-testid="button-add-transaction">
              <Plus aria-hidden="true" />
              <span className="label-long">Novo lançamento</span>
              <span className="label-short">Novo</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="page">
        {isLoading ? (
          <div className="loading" role="status">
            Carregando seus lançamentos…
          </div>
        ) : loadError ? (
          <section className="problem" role="alert">
            <h1>Não foi possível abrir seus lançamentos</h1>
            <p>Verifique sua conexão e tente de novo. Seus dados continuam salvos.</p>
            <div className="actions">
              <button className="button primary" onClick={ledger.retry}>
                Tentar novamente
              </button>
              <button className="button" onClick={auth.signOut}>
                Sair da conta
              </button>
            </div>
          </section>
        ) : (
          <>
            {saveError && (
              <p className="problem-line" role="alert">
                Não foi possível salvar a última alteração.{" "}
                <button className="link" onClick={backup}>
                  Baixar uma cópia dos registros
                </button>
              </p>
            )}

            {section === "overview" ? (
              <>
                <div className="page-head">
                  <div>
                    <h1 id="page-title" tabIndex={-1}>
                      Painel
                    </h1>
                  </div>
                  <label className="field-inline">
                    <span>Período</span>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                      data-testid="select-period"
                    >
                      {Object.entries(periodLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <MarketCard />

                <section className="figures" aria-label={`Resumo — ${periodLabels[period]}`}>
                  <div className="figure figure-balance">
                    <span className="figure-label">Saldo</span>
                    <strong
                      className={`balance ${totals.balance < 0 ? "is-negative" : ""}`}
                      data-testid="text-current-balance"
                    >
                      {formatMoney(totals.balance)}
                    </strong>
                  </div>
                  <div className="figure">
                    <span className="figure-label">Entradas</span>
                    <strong className="amount" data-testid="text-income">
                      {formatMoney(totals.income)}
                    </strong>
                    <span className="figure-sub">{plural(countOf("income"), "lançamento")}</span>
                  </div>
                  <div className="figure">
                    <span className="figure-label">Saídas</span>
                    <strong className="amount" data-testid="text-expenses">
                      {formatMoney(totals.expenses)}
                    </strong>
                    <span className="figure-sub">{plural(countOf("expense"), "lançamento")}</span>
                  </div>
                  <div className="figure figure-savings">
                    <span className="figure-label">Sobra das entradas</span>
                    <strong className={`amount ${totals.balance < 0 ? "is-negative" : ""}`}>
                      {totals.savingsRate === null ? "—" : `${totals.savingsRate}%`}
                    </strong>
                    <div className="savings-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(100, totals.savingsRate || 0))}%` }} />
                    </div>
                  </div>
                </section>

                <div className="split">
                  <section className="block" aria-labelledby="chart-title">
                    <div className="block-head">
                      <h2 id="chart-title">Entradas e saídas</h2>
                      <div className="key" aria-hidden="true">
                        <span>
                          <i className="swatch in" /> Entradas
                        </span>
                        <span>
                          <i className="swatch out" /> Saídas
                        </span>
                      </div>
                    </div>
                    {monthly.some((m) => m.income || m.expenses) ? (
                      <MonthlyChart data={monthly} />
                    ) : (
                      <p className="empty">Nenhum lançamento neste período.</p>
                    )}
                  </section>

                  <section className="block" aria-labelledby="cat-title">
                    <div className="block-head">
                      <h2 id="cat-title">Saídas por categoria</h2>
                    </div>
                    {byCategory.length ? (
                      <ol className="categories">
                        {byCategory.map((c) => {
                          const share = totals.expenses ? (c.value / totals.expenses) * 100 : 0;
                          return (
                            <li key={c.name}>
                              <div className="cat-line">
                                <span>{c.name}</span>
                                <span className="amount-sm">{formatMoney(c.value)}</span>
                                <span className="cat-share">{Math.round(share)}%</span>
                              </div>
                              <div className="cat-bar" aria-hidden="true">
                                <span style={{ width: `${Math.max(share, 0.8)}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="empty">Nenhuma saída neste período.</p>
                    )}
                  </section>
                </div>

                <section className="block" aria-labelledby="latest-title">
                  <div className="block-head">
                    <h2 id="latest-title">Últimos lançamentos</h2>
                    <button
                      className="link"
                      onClick={() => {
                        setFilters({ ...emptyFilters, period });
                        goTo("transactions");
                      }}
                    >
                      Ver todos
                    </button>
                  </div>
                  {latest.length ? (
                    <TransactionTable items={latest} onEdit={openForm} onDelete={askDelete} />
                  ) : (
                    <p className="empty">
                      {transactions.length ? "Nenhum lançamento neste período." : "Nenhum lançamento ainda."}{" "}
                      <button className="link" onClick={() => openForm()}>
                        Adicionar lançamento
                      </button>
                    </p>
                  )}
                </section>

              </>
            ) : (
              <>
                <div className="page-head">
                  <div>
                    <h1 id="page-title" tabIndex={-1}>
                      Movimentações
                    </h1>
                    <p className="page-note" aria-live="polite">
                      {plural(filtered.length, "lançamento")}
                      {hasFilters ? " encontrados" : ""} · saldo da seleção{" "}
                      <strong className="amount-sm">{formatMoney(filteredTotals.balance)}</strong>
                    </p>
                  </div>
                  <button className="button" onClick={exportCsv} disabled={!filtered.length}>
                    <Download aria-hidden="true" />
                    Exportar CSV
                  </button>
                </div>

                <div className="toolbar" role="search">
                  <div className="segmented" role="group" aria-label="Tipo">
                    {(
                      [
                        ["all", "Todos"],
                        ["income", "Entradas"],
                        ["expense", "Saídas"],
                      ] as const
                    ).map(([type, label]) => (
                      <button
                        key={type}
                        aria-pressed={filters.type === type}
                        onClick={() => setFilters({ ...filters, type })}
                        data-testid={`filter-${type}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="search">
                    <Search aria-hidden="true" />
                    <input
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder="Buscar por descrição ou categoria"
                      aria-label="Buscar"
                      data-testid="input-search-transactions"
                    />
                    {filters.search && (
                      <button aria-label="Limpar busca" onClick={() => setFilters({ ...filters, search: "" })}>
                        <X />
                      </button>
                    )}
                  </label>
                  <select
                    aria-label="Categoria"
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  >
                    <option value="all">Todas as categorias</option>
                    {allCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Período"
                    value={filters.period}
                    onChange={(e) => setFilters({ ...filters, period: e.target.value as PeriodFilter })}
                  >
                    {Object.entries(periodLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {hasFilters && (
                    <button className="link" onClick={() => setFilters(emptyFilters)}>
                      Limpar filtros
                    </button>
                  )}
                </div>

                <section className="block flush" aria-label="Lista de lançamentos">
                  {pageItems.length ? (
                    <>
                      <TransactionTable items={pageItems} onEdit={openForm} onDelete={askDelete} />
                      {pageCount > 1 && (
                        <div className="pager">
                          <span>
                            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de{" "}
                            {filtered.length}
                          </span>
                          <div>
                            <button
                              className="icon"
                              aria-label="Página anterior"
                              disabled={currentPage === 1}
                              onClick={() => setPage(currentPage - 1)}
                            >
                              <ChevronLeft />
                            </button>
                            <span>
                              {currentPage} / {pageCount}
                            </span>
                            <button
                              className="icon"
                              aria-label="Próxima página"
                              disabled={currentPage === pageCount}
                              onClick={() => setPage(currentPage + 1)}
                            >
                              <ChevronRight />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : hasFilters ? (
                    <p className="empty">
                      Nada encontrado com esses filtros.{" "}
                      <button className="link" onClick={() => setFilters(emptyFilters)}>
                        Limpar filtros
                      </button>
                    </p>
                  ) : (
                    <p className="empty">
                      Você ainda não tem lançamentos.{" "}
                      <button className="link" onClick={() => openForm()}>
                        Adicionar o primeiro
                      </button>
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <span>Finance Flow</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>

      {modal === "form" && (
        <TransactionModal
          transaction={editing}
          onClose={closeModal}
          onSave={saveTransaction}
          pending={pending}
          saveError={saveError}
        />
      )}
      {modal === "profile" && (
        <ProfileModal
          name={auth.name}
          email={auth.user?.email || ""}
          onClose={closeModal}
          onSignOut={auth.signOut}
          onSave={async (name) => {
            await auth.updateName(name);
            closeModal();
            setNotice("Nome atualizado.");
          }}
        />
      )}
      {modal === "delete" && deleting && (
        <Modal title="Excluir lançamento?" description="Esta ação não pode ser desfeita." onClose={closeModal} small>
          <div className="modal-body">
            <div className="delete-preview">
              <strong>{deleting.description}</strong>
              <span>
                {formatMoney(deleting.amount)} · {formatDate(deleting.date)}
              </span>
            </div>
            {saveError && (
              <p className="field-error" role="alert">
                Não foi possível excluir. Tente novamente.
              </p>
            )}
            <div className="modal-actions">
              <button className="button" data-initial-focus onClick={closeModal}>
                Manter
              </button>
              <button
                className="button danger"
                data-testid="button-confirm-delete"
                disabled={pending}
                onClick={async () => {
                  if (await ledger.remove(deleting.id)) {
                    closeModal();
                    setNotice("Lançamento excluído.");
                  }
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status" data-testid="status-success">
          {notice}
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            <X />
          </button>
        </div>
      )}
    </>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function TransactionTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Transaction[];
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  return (
    <table className="ledger">
      <thead>
        <tr>
          <th scope="col" className="col-date">
            Data
          </th>
          <th scope="col">Descrição</th>
          <th scope="col" className="col-cat">
            Categoria
          </th>
          <th scope="col" className="col-value">
            Valor
          </th>
          <th scope="col" className="col-actions">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => (
          <tr key={t.id} data-testid={`row-transaction-${t.id}`}>
            <td className="col-date">
              <time dateTime={t.date}>{t.date.split("-").reverse().join("/")}</time>
            </td>
            <td className="col-desc">
              <span className="desc">{t.description}</span>
              <span className="desc-meta">
                {t.category} · {t.date.split("-").reverse().join("/")}
              </span>
            </td>
            <td className="col-cat">{t.category}</td>
            <td className={`col-value ${t.type}`}>
              {t.type === "income" ? "+" : "−"}
              {formatMoney(t.amount)}
            </td>
            <td className="col-actions">
              <button className="icon" onClick={() => onEdit(t)} aria-label={`Editar ${t.description}`}>
                <Pencil />
              </button>
              <button className="icon" onClick={() => onDelete(t)} aria-label={`Excluir ${t.description}`}>
                <Trash2 />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TransactionModal({
  transaction,
  onClose,
  onSave,
  pending,
  saveError,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  onSave: (form: TransactionForm) => void;
  pending: boolean;
  saveError: boolean;
}) {
  const [form, setForm] = useState<TransactionForm>(
    transaction
      ? { ...transaction, amount: transaction.amount.toFixed(2).replace(".", ",") }
      : { description: "", amount: "", type: "expense", category: "Alimentação", date: localDate() },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionForm, string>>>({});
  function update(field: keyof TransactionForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }
  function setType(type: Transaction["type"]) {
    update("type", type);
    if (type === "income" && form.category === "Alimentação") update("category", "Salário");
    if (type === "expense" && form.category === "Salário") update("category", "Alimentação");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (form.description.trim().length < 2) next.description = "Descreva o lançamento com pelo menos 2 caracteres.";
    if (!Number.isFinite(parseAmount(form.amount))) next.amount = "Informe um valor entre R$ 0,01 e R$ 999.999.999,99.";
    if (!form.category.trim()) next.category = "Escolha uma categoria.";
    if (!isValidDate(form.date)) next.date = "Informe uma data válida.";
    if (Object.keys(next).length) {
      setErrors(next);
      window.requestAnimationFrame(() => document.getElementById(Object.keys(next)[0])?.focus());
      return;
    }
    onSave({ ...form, description: form.description.trim() });
  }
  const formCategories = [...new Set([...categories, form.category])];
  return (
    <Modal
      title={transaction ? "Editar lançamento" : "Novo lançamento"}
      description="Preencha os dados abaixo."
      onClose={onClose}
    >
      <form className="modal-body" onSubmit={submit} noValidate>
        {saveError && (
          <p className="field-error" role="alert">
            Não foi possível salvar. Tente novamente.
          </p>
        )}
        <div className="form-grid">
          <div className="field full">
            <span className="field-label" id="type-label">
              Tipo
            </span>
            <div className="segmented wide" role="group" aria-labelledby="type-label">
              <button
                type="button"
                aria-pressed={form.type === "income"}
                onClick={() => setType("income")}
                data-testid="button-type-income"
              >
                Entrada
              </button>
              <button
                type="button"
                aria-pressed={form.type === "expense"}
                onClick={() => setType("expense")}
                data-testid="button-type-expense"
              >
                Saída
              </button>
            </div>
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="description">
              Descrição
            </label>
            <input
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Ex.: Mercado do mês"
              maxLength={140}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "description-error" : undefined}
              data-testid="input-description"
              data-initial-focus
            />
            {errors.description && (
              <span id="description-error" className="field-error">
                {errors.description}
              </span>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="amount">
              Valor (R$)
            </label>
            <input
              id="amount"
              className="input-money"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
              placeholder="0,00"
              maxLength={20}
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? "amount-error" : undefined}
              data-testid="input-amount"
            />
            {errors.amount && (
              <span id="amount-error" className="field-error">
                {errors.amount}
              </span>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="date">
              Data
            </label>
            <input
              type="date"
              id="date"
              min="1900-01-01"
              max="2100-12-31"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? "date-error" : undefined}
              data-testid="input-date"
            />
            {errors.date && (
              <span id="date-error" className="field-error">
                {errors.date}
              </span>
            )}
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="category">
              Categoria
            </label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              data-testid="select-form-category"
            >
              {formCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={pending} data-testid="button-save-transaction">
            <Check aria-hidden="true" />
            {transaction ? "Salvar alterações" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
