import {
  marketAssets,
  parseAwesomeQuotes,
  type ExchangeRatesResponse,
} from "../lib/market";
export type { ExchangeRate, ExchangeRatesResponse } from "../lib/market";
const api = "https://economia.awesomeapi.com.br";

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(cancel, 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("A fonte de cotações não respondeu.");
    return await response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
export async function fetchExchangeRates(
  signal?: AbortSignal,
): Promise<ExchangeRatesResponse> {
  if (!navigator.onLine)
    throw new Error(
      "Sem conexão. Os últimos valores recebidos foram mantidos.",
    );
  const data = await fetchJson(
    `${api}/json/last/BTC-BRL,USD-BRL,EUR-BRL`,
    signal,
  );
  const rates = parseAwesomeQuotes(data);
  if (!rates.length) throw new Error("Não foi possível obter as cotações.");
  const missing = marketAssets.filter(
    (asset) => !rates.some((rate) => rate.symbol === asset.symbol),
  );
  return {
    source: "AwesomeAPI",
    fetchedAt: new Date().toISOString(),
    rates,
    unavailable: missing.map((asset) => asset.symbol),
    warning: missing.length
      ? `Sem atualização para: ${missing.map((a) => a.name).join(", ")}.`
      : null,
  };
}
