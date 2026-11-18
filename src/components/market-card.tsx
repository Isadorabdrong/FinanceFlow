import { useMarket, type StreamState } from "../hooks/use-market";
import { marketAssets, type ExchangeRate } from "../lib/market";

const time = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
});
const names: Record<string, string> = { USD: "Dólar", EUR: "Euro", BTC: "Bitcoin" };

// Diz de onde veio o número e quando — sem selo "ao vivo".
function statusOf(rate: ExchangeRate | null, stream: StreamState, now: number, failed: boolean, refreshing: boolean) {
  if (!navigator.onLine) return "sem conexão";
  if (!rate) return refreshing ? "consultando…" : "indisponível";
  const age = now - Date.parse(rate.updatedAt);
  if (rate.source === "Binance" && stream !== "live") return `${rate.source} · conexão interrompida`;
  if (failed) return `${rate.source} · último valor recebido`;
  if (age > 300_000) return `${rate.source} · ${time.format(new Date(rate.updatedAt))} (sem atualização recente)`;
  return `${rate.source} · ${time.format(new Date(rate.updatedAt))}`;
}

export function MarketCard() {
  const { rates, data, error, refreshing, stream, now, refresh } = useMarket();
  // Moedas primeiro (o que mais pesa no dia a dia), bitcoin por último.
  const order = ["USD", "EUR", "BTC"];
  const assets = [...marketAssets].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
  return (
    <section className="block market" aria-labelledby="market-title">
      <div className="block-head">
        <h2 id="market-title">Cotações em reais</h2>
        <button className="link" onClick={refresh} disabled={refreshing} data-testid="button-refresh-market">
          {refreshing ? "Consultando…" : "Atualizar"}
        </button>
      </div>
      <dl className="quotes">
        {assets.map((asset) => {
          const rate = rates[marketAssets.indexOf(asset)];
          const change = rate?.changePercent;
          const failed = Boolean(error || data?.unavailable.includes(asset.symbol));
          return (
            <div className="quote" key={asset.code} data-testid={`quote-${asset.code}`}>
              <dt>
                {names[asset.code]} <span className="quote-pair">{asset.symbol}</span>
              </dt>
              <dd className="quote-value" data-testid={`quote-value-${asset.code}`}>
                {rate
                  ? new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      minimumFractionDigits: asset.code === "BTC" ? 0 : 4,
                      maximumFractionDigits: asset.code === "BTC" ? 0 : 4,
                    }).format(rate.value)
                  : "—"}
                {change != null && (
                  <span className="quote-change" title="Variação informada pela fonte">
                    {change > 0 ? "+" : change < 0 ? "−" : ""}
                    {Math.abs(change).toFixed(2).replace(".", ",")}%
                  </span>
                )}
              </dd>
              <dd className="quote-meta" data-testid={`quote-status-${asset.code}`}>
                {statusOf(rate, stream, now, failed, refreshing)}
              </dd>
            </div>
          );
        })}
      </dl>
      {(error || data?.warning) && (
        <p className="quote-warning" role="status">
          {error || data?.warning}
        </p>
      )}
    </section>
  );
}
