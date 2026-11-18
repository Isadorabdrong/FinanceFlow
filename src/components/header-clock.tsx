import { useEffect, useState } from "react";
const zone = "America/Sao_Paulo";
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: zone,
});
const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: zone,
});
export function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return (
    <div className="header-clock" aria-label="Data e horário de Brasília">
      <time
        className="header-today"
        dateTime={now.toISOString()}
        data-testid="header-date"
      >
        {dayFormat.format(now)}
      </time>
      <div className="header-time-row">
        <time
          dateTime={now.toISOString()}
          className="header-time"
          data-testid="header-time"
        >
          {timeFormat.format(now)}
        </time>
        <span>Brasília</span>
      </div>
    </div>
  );
}
