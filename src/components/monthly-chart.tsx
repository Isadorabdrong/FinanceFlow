import { useEffect, useRef, useState } from "react";
import { formatMoney } from "../lib/finance";

type Month = { key: string; month: string; label: string; income: number; expenses: number };

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

// Gráfico de barras agrupadas em SVG puro: sem biblioteca de gráficos,
// fácil de ler e de explicar. Mede a largura real para o texto não distorcer.
export function MonthlyChart({ data }: { data: Month[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = 220;
  const pad = { top: 12, right: 4, bottom: 26, left: 44 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((m) => Math.max(m.income, m.expenses)), 1));
  const ticks = [0, max / 2, max];
  const slot = innerW / data.length;
  const bar = Math.min(22, Math.max(4, slot * 0.28));
  const gap = Math.min(4, bar * 0.2);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const shown = active ?? data.length - 1;
  const current = data[shown];

  return (
    <div className="chart">
      <p className="chart-readout" aria-live="polite">
        <span className="chart-month">{current.label}</span>
        <span>
          entrou <strong className="amount-sm">{formatMoney(current.income)}</strong>
        </span>
        <span>
          saiu <strong className="amount-sm">{formatMoney(current.expenses)}</strong>
        </span>
      </p>
      <div ref={box} className="chart-box">
        <svg width={width} height={height} role="img" aria-label="Entradas e saídas por mês. Os valores estão na tabela abaixo.">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tick">
                {compact.format(t)}
              </text>
            </g>
          ))}
          {data.map((m, i) => {
            const cx = pad.left + slot * i + slot / 2;
            const dim = active !== null && active !== i;
            return (
              <g
                key={m.key}
                className={dim ? "dim" : undefined}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="transparent" />
                <rect className="bar-in" x={cx - bar - gap / 2} y={y(m.income)} width={bar} height={y(0) - y(m.income)} />
                <rect className="bar-out" x={cx + gap / 2} y={y(m.expenses)} width={bar} height={y(0) - y(m.expenses)} />
                <text x={cx} y={height - 6} textAnchor="middle" className={`tick ${i === shown ? "on" : ""}`}>
                  {m.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <details className="chart-table">
        <summary>Ver os valores em tabela</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Entradas</th>
              <th scope="col">Saídas</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.key}>
                <th scope="row">{m.label}</th>
                <td>{formatMoney(m.income)}</td>
                <td>{formatMoney(m.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function niceMax(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}
