import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../lib/finance";

type Row = {
  id: string;
  description: string;
  amount_cents: number;
  type: Transaction["type"];
  category: string;
  date: string;
};

// O banco guarda centavos inteiros; a tela trabalha em reais.
const fromRow = (row: Row): Transaction => ({
  id: row.id,
  description: row.description,
  amount: row.amount_cents / 100,
  type: row.type,
  category: row.category,
  date: row.date,
});
const toRow = (t: Transaction) => ({
  description: t.description,
  amount_cents: Math.round(t.amount * 100),
  type: t.type,
  category: t.category,
  date: t.date,
});
const sortByDate = (items: Transaction[]) =>
  [...items].sort((a, b) => b.date.localeCompare(a.date));

export function useLedger(userId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    // Não precisa filtrar por usuário aqui: a regra RLS do banco já devolve
    // só as linhas de quem está logado.
    const { data, error } = await supabase
      .from("transactions")
      .select("id, description, amount_cents, type, category, date")
      .order("date", { ascending: false });
    if (error) setLoadError(true);
    else setTransactions((data as Row[]).map(fromRow));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setTransactions([]);
    load();
  }, [userId, load]);

  async function run<T>(action: () => Promise<T | null>) {
    setPending(true);
    setSaveError(false);
    try {
      const result = await action();
      if (result === null) setSaveError(true);
      return result !== null;
    } finally {
      setPending(false);
    }
  }

  async function save(t: Transaction, isEdit: boolean) {
    return run(async () => {
      const query = isEdit
        ? supabase.from("transactions").update(toRow(t)).eq("id", t.id)
        : supabase.from("transactions").insert(toRow(t));
      const { data, error } = await query.select("id, description, amount_cents, type, category, date").single();
      if (error || !data) return null;
      const saved = fromRow(data as Row);
      setTransactions((items) =>
        sortByDate(isEdit ? items.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...items]),
      );
      return saved;
    });
  }

  async function remove(id: string) {
    return run(async () => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) return null;
      setTransactions((items) => items.filter((i) => i.id !== id));
      return true;
    });
  }

  return { transactions, isLoading, loadError, saveError, pending, retry: load, save, remove };
}
