import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAwesomeQuotes,
  parseBinanceTicker,
  quoteTimestamp,
} from "../src/lib/market.ts";

const now = Date.parse("2026-10-03T21:30:00Z");
const quote = (code: string, bid = "5.2345") => ({
  code,
  codein: "BRL",
  bid,
  timestamp: String(now / 1000),
  varBid: "-0.0123",
  pctChange: "-0.23",
});
const ticker = {
  e: "24hrTicker",
  s: "BTCBRL",
  E: now,
  c: "450000.12",
  p: "-5000",
  P: "-1.10",
  h: "459000",
  l: "449000",
};

test("mantém preço, par e horário da fonte sem simular atualização", () => {
  const old = now - 86_400_000;
  const rates = parseAwesomeQuotes(
    {
      BTCBRL: quote("BTC", "450000.12"),
      USDBRL: { ...quote("USD"), timestamp: String(old / 1000) },
      EURBRL: quote("EUR", "6.1234"),
    },
    now,
  );
  assert.deepEqual(
    rates.map((r) => r.symbol),
    ["BTC/BRL", "USD/BRL", "EUR/BRL"],
  );
  assert.equal(rates[0].value, 450000.12);
  assert.equal(rates[1].value, 5.2345);
  assert.equal(rates[1].updatedAt, new Date(old).toISOString());
  assert.equal(rates[1].changePercent, -0.23);
  assert.equal(rates[1].quoteType, "bid");
});
test("recusa preços ausentes, não finitos, negativos e pares incompatíveis", () => {
  for (const bid of ["", "0", "-1", "NaN", "Infinity", "5,1234"])
    assert.deepEqual(
      parseAwesomeQuotes({ USDBRL: quote("USD", bid) }, now),
      [],
    );
  assert.deepEqual(parseAwesomeQuotes({ USDBRL: quote("EUR") }, now), []);
  assert.deepEqual(
    parseAwesomeQuotes(
      { USDBRL: { ...quote("USD"), timestamp: "garbage" } },
      now,
    ),
    [],
  );
  assert.deepEqual(parseAwesomeQuotes(null, now), []);
  const [rate] = parseAwesomeQuotes(
    { USDBRL: { ...quote("USD"), pctChange: null, varBid: undefined } },
    now,
  );
  assert.equal(rate.change, null);
  assert.equal(rate.changePercent, null);
});
test("interpreta timestamps em segundos e milissegundos, rejeita futuro inválido", () => {
  assert.equal(
    quoteTimestamp(now, now),
    quoteTimestamp(String(now / 1000), now),
  );
  for (const invalid of [
    undefined,
    0,
    -1,
    Infinity,
    "",
    Date.UTC(2008, 0, 1),
    now + 61_000,
  ])
    assert.equal(quoteTimestamp(invalid, now), null);
});
test("Bitcoin ao vivo exige mensagem válida, BTC/BRL e timestamp recente", () => {
  const parsed = parseBinanceTicker(ticker, now);
  assert.equal(parsed?.value, 450000.12);
  assert.equal(parsed?.source, "Binance");
  assert.equal(parsed?.quoteType, "last");
  for (const overrides of [
    { s: "BTCUSDT" },
    { e: "trade" },
    { E: now - 15001 },
    { E: now + 61000 },
    { c: "0" },
    { c: "Infinity" },
  ])
    assert.equal(parseBinanceTicker({ ...ticker, ...overrides }, now), null);
  assert.equal(parseBinanceTicker(null, now), null);
});
