export type ExchangeRate = {
  symbol: string;
  name: string;
  value: number;
  change: number | null;
  changePercent: number | null;
  updatedAt: string;
  source: "AwesomeAPI" | "Binance";
  high: number | null;
  low: number | null;
  quoteType: "bid" | "last";
};
export type ExchangeRatesResponse = {
  source: string;
  fetchedAt: string;
  rates: ExchangeRate[];
  warning: string | null;
  unavailable: string[];
};
export const marketAssets = [
  { code: "BTC", symbol: "BTC/BRL", name: "Bitcoin" },
  { code: "USD", symbol: "USD/BRL", name: "Dólar americano" },
  { code: "EUR", symbol: "EUR/BRL", name: "Euro" },
] as const;
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function number(value: unknown) {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^-?\d+(\.\d+)?$/.test(value))
  )
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function positive(value: unknown) {
  const parsed = number(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}
export function quoteTimestamp(value: unknown, now = Date.now()) {
  const n = positive(value);
  if (n === null) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  if (ms < Date.UTC(2009, 0, 1) || ms > now + 60_000) return null;
  return new Date(ms).toISOString();
}
export function parseAwesomeQuotes(
  payload: unknown,
  now = Date.now(),
): ExchangeRate[] {
  const data = object(payload);
  if (!data) return [];
  return marketAssets.flatMap((asset) => {
    const raw = object(data[`${asset.code}BRL`]);
    if (!raw || raw.code !== asset.code || raw.codein !== "BRL") return [];
    const value = positive(raw.bid),
      updatedAt = quoteTimestamp(raw.timestamp, now);
    if (value === null || !updatedAt) return [];
    return [
      {
        symbol: asset.symbol,
        name: asset.name,
        value,
        updatedAt,
        change: number(raw.varBid),
        changePercent: number(raw.pctChange),
        source: "AwesomeAPI" as const,
        quoteType: "bid" as const,
        high: positive(raw.high),
        low: positive(raw.low),
      },
    ];
  });
}
export function parseBinanceTicker(
  payload: unknown,
  now = Date.now(),
): ExchangeRate | null {
  const raw = object(payload);
  if (!raw || raw.e !== "24hrTicker" || raw.s !== "BTCBRL") return null;
  const value = positive(raw.c),
    updatedAt = quoteTimestamp(raw.E, now);
  if (value === null || !updatedAt || now - Date.parse(updatedAt) > 15_000)
    return null;
  return {
    symbol: "BTC/BRL",
    name: "Bitcoin",
    value,
    updatedAt,
    change: number(raw.p),
    changePercent: number(raw.P),
    source: "Binance",
    quoteType: "last",
    high: positive(raw.h),
    low: positive(raw.l),
  };
}
