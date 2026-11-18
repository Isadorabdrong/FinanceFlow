import { useEffect, useRef, useState } from "react";
import { fetchExchangeRates } from "../services/exchange-rates";
import {
  marketAssets,
  parseBinanceTicker,
  type ExchangeRate,
  type ExchangeRatesResponse,
} from "../lib/market";

export type StreamState =
  "connecting" | "live" | "reconnecting" | "offline" | "paused";
export function useMarket() {
  const [data, setData] = useState<ExchangeRatesResponse | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [bitcoin, setBitcoin] = useState<ExchangeRate | null>(null);
  const [stream, setStream] = useState<StreamState>("connecting");
  const [now, setNow] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const dataRef = useRef<ExchangeRatesResponse | null>(null);
  const refreshingRef = useRef(false);
  const lastAttempt = useRef(0);
  const lastTicker = useRef(0);

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    const offlineMessage = () =>
      dataRef.current
        ? "Sem conexão. Os últimos valores recebidos foram mantidos."
        : "As cotações precisam de internet. Seus lançamentos continuam disponíveis.";
    async function update() {
      if (stopped || document.hidden || refreshingRef.current) return;
      if (!navigator.onLine) {
        setError(offlineMessage());
        return;
      }
      const request = new AbortController();
      controller = request;
      // Limit failed automatic attempts too, so an unavailable provider is not flooded.
      lastAttempt.current = Date.now();
      refreshingRef.current = true;
      setRefreshing(true);
      try {
        const next = await fetchExchangeRates(request.signal);
        if (stopped || request.signal.aborted) return;
        const previous = dataRef.current?.rates || [];
        const rates = marketAssets.flatMap((asset) => {
          const incoming = next.rates.find(
            (rate) => rate.symbol === asset.symbol,
          );
          const old = previous.find((rate) => rate.symbol === asset.symbol);
          const selected =
            incoming && (!old || incoming.updatedAt >= old.updatedAt)
              ? incoming
              : old;
          return selected ? [selected] : [];
        });
        const value = { ...next, rates };
        dataRef.current = value;
        setData(value);
        setError("");
      } catch {
        if (!stopped && !request.signal.aborted)
          setError(
            dataRef.current
              ? "A consulta falhou. Os valores exibidos são os últimos recebidos."
              : "Não foi possível consultar as moedas. Tentaremos novamente em até 60 segundos.",
          );
      } finally {
        if (!stopped && controller === request) {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      }
    }
    void update();
    const due = () => {
      if (!document.hidden && Date.now() - lastAttempt.current >= 60_000)
        void update();
    };
    const interval = window.setInterval(due, 1000);
    const online = () => void update();
    const offline = () => {
      controller?.abort();
      refreshingRef.current = false;
      setRefreshing(false);
      setError(offlineMessage());
    };
    document.addEventListener("visibilitychange", due);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      stopped = true;
      controller?.abort();
      refreshingRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", due);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [refreshKey]);

  useEffect(() => {
    let stopped = false,
      attempt = 0;
    let socket: WebSocket | null = null;
    let reconnect = 0;
    let received = 0,
      connected = 0;
    const schedule = () => {
      if (stopped || !navigator.onLine || document.hidden || reconnect) return;
      setStream("reconnecting");
      reconnect = window.setTimeout(
        () => {
          reconnect = 0;
          connect();
        },
        Math.min(30_000, 2000 * 2 ** Math.min(attempt++, 4)),
      );
    };
    function connect() {
      if (stopped || socket) return;
      if (!navigator.onLine) {
        setStream("offline");
        return;
      }
      if (document.hidden) {
        setStream("paused");
        return;
      }
      setStream(attempt ? "reconnecting" : "connecting");
      connected = Date.now();
      received = 0;
      let current: WebSocket;
      try {
        current = new WebSocket(
          "wss://stream.binance.com:9443/ws/btcbrl@ticker",
        );
      } catch {
        schedule();
        return;
      }
      socket = current;
      current.onmessage = (event) => {
        if (stopped || socket !== current) return;
        let payload: unknown;
        try {
          payload = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const next = parseBinanceTicker(payload);
        if (!next) return;
        const timestamp = Date.parse(next.updatedAt);
        if (timestamp <= lastTicker.current) return;
        lastTicker.current = timestamp;
        received = Date.now();
        attempt = 0;
        setNow(received);
        setStream("live");
        setBitcoin(next);
      };
      current.onclose = () => {
        if (socket !== current) return;
        socket = null;
        schedule();
      };
      current.onerror = () => {
        if (socket === current) current.close();
      };
    }
    function disconnect() {
      clearTimeout(reconnect);
      reconnect = 0;
      const current = socket;
      socket = null;
      if (current) {
        current.onclose = null;
        current.onerror = null;
        current.onmessage = null;
        current.close();
      }
    }
    const resume = () => {
      if (!navigator.onLine) {
        disconnect();
        setStream("offline");
      } else if (document.hidden) {
        disconnect();
        setStream("paused");
      } else {
        disconnect();
        connect();
      }
    };
    connect();
    const heartbeat = window.setInterval(() => {
      setNow(Date.now());
      if (socket && Date.now() - (received || connected) > 15_000) {
        disconnect();
        schedule();
      }
    }, 1000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    return () => {
      stopped = true;
      disconnect();
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
    };
  }, [refreshKey]);

  const rates = marketAssets.map((asset) => {
    const quote = data?.rates.find((rate) => rate.symbol === asset.symbol);
    if (
      asset.code === "BTC" &&
      bitcoin &&
      (stream === "live" || !quote || bitcoin.updatedAt >= quote.updatedAt)
    )
      return bitcoin;
    return quote || null;
  });
  return {
    rates,
    data,
    error,
    refreshing,
    stream,
    now,
    refresh: () => {
      if (!refreshingRef.current) setRefreshKey((key) => key + 1);
    },
  };
}
