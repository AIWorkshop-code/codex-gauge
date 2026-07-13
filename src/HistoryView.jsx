import { LockSimple, Trash } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

const CHART = { width: 1240, height: 480, left: 62, right: 28, top: 54, bottom: 50 };
const Y_TICKS = [100, 75, 50, 25, 0];
const PREVIEW_HISTORY = Array.from({ length: 9 }, (_, index) => ({
  timestamp: Date.now() - (8 - index) * 3.75 * 24 * 60 * 60 * 1000,
  secondaryRemaining: 84 - index * 0.35,
  source: "preview",
}));

function chartDomain(entries) {
  const latest = entries.at(-1)?.timestamp || Date.now();
  const earliest = entries[0]?.timestamp || latest - 24 * 60 * 60 * 1000;
  return { start: Math.min(earliest, latest - 24 * 60 * 60 * 1000), end: latest };
}

function chartPoint(entry, key, domain) {
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const x = CHART.left + ((entry.timestamp - domain.start) / Math.max(1, domain.end - domain.start)) * plotWidth;
  const y = CHART.top + ((100 - entry[key]) / 100) * plotHeight;
  return { x, y };
}

function pointsFor(entries, key, domain) {
  return entries.map((entry) => {
    const point = chartPoint(entry, key, domain);
    return `${point.x},${point.y}`;
  }).join(" ");
}

function consumptionRate(entries, key) {
  if (entries.length < 2) return "0.0% / 小时";
  const first = entries[0];
  const last = entries.at(-1);
  const hours = (last.timestamp - first.timestamp) / 3_600_000;
  if (hours <= 0) return "0.0% / 小时";
  return `${Math.max(0, (first[key] - last[key]) / hours).toFixed(1)}% / 小时`;
}

function formatAxisDate(timestamp, includeTime = false) {
  return new Intl.DateTimeFormat("zh-CN", includeTime
    ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "numeric", day: "numeric" }).format(timestamp);
}

function xTicks(domain) {
  return Array.from({ length: 7 }, (_, index) => {
    const ratio = index / 6;
    return { ratio, timestamp: domain.start + (domain.end - domain.start) * ratio };
  });
}

export function HistoryView() {
  const [entries, setEntries] = useState(() => (
    window.codexQuota?.readHistory ? [] : PREVIEW_HISTORY
  ));
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    window.codexQuota?.readHistory?.().then(setEntries);
    return window.codexQuota?.onHistoryUpdated?.(setEntries);
  }, []);

  const recent = useMemo(() => entries.slice(-720), [entries]);
  const latest = recent.at(-1);
  const domain = useMemo(() => chartDomain(recent), [recent]);
  const secondaryPoint = latest ? chartPoint(latest, "secondaryRemaining", domain) : null;

  const clear = async () => {
    await window.codexQuota?.clearHistory?.();
    setEntries([]);
    setConfirmClear(false);
  };

  return (
    <main className="history-page">
      <header className="history-header">
        <div className="history-title-row">
          <h1>用量历史</h1>
          <p><LockSimple size={17} weight="regular" />本地保存最近 30 天，每分钟最多记录一个快照。</p>
        </div>
        {confirmClear ? (
          <div className="clear-confirm" role="alert">
            <span>确认清除全部记录？</span>
            <button type="button" onClick={() => setConfirmClear(false)}>取消</button>
            <button className="danger" type="button" onClick={clear}>确认清除</button>
          </div>
        ) : (
          <button className="clear-button" type="button" onClick={() => setConfirmClear(true)} disabled={entries.length === 0}>
            <Trash size={19} weight="regular" />清除记录
          </button>
        )}
      </header>

      <section className="history-summary" aria-label="当前额度摘要">
        <article className="quota-summary secondary">
          <span className="metric-label"><i />7D 剩余</span>
          <div className="metric-main"><strong>{latest ? `${latest.secondaryRemaining}%` : "--"}</strong><span><b>{consumptionRate(recent, "secondaryRemaining")}</b>消耗速率</span></div>
        </article>
        <article className="sample-summary">
          <span>样本</span>
          <strong>{entries.length}</strong>
          <small>仅保存在本机</small>
        </article>
      </section>

      <section className="history-chart-card">
        <header className="chart-header">
          <div><h2>用量剩余百分比趋势</h2><span>最近 30 天</span></div>
          <div className="chart-legend"><span className="secondary-dot">7D 剩余</span></div>
        </header>
        {recent.length > 0 ? (
          <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label="7天额度历史趋势">
            {Y_TICKS.map((value) => {
              const y = CHART.top + ((100 - value) / 100) * (CHART.height - CHART.top - CHART.bottom);
              return <g key={value}><line className="grid-line" x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} /><text className="axis-label y-label" x={CHART.left - 18} y={y + 5}>{value}%</text></g>;
            })}
            {xTicks(domain).map(({ ratio, timestamp }) => {
              const x = CHART.left + ratio * (CHART.width - CHART.left - CHART.right);
              return <text className="axis-label x-label" key={ratio} x={x} y={CHART.height - 12}>{formatAxisDate(timestamp)}</text>;
            })}
            <polyline className="secondary-line" points={pointsFor(recent, "secondaryRemaining", domain)} />
            {secondaryPoint && <circle className="secondary-point" cx={secondaryPoint.x} cy={secondaryPoint.y} r="6" />}
            {latest && <text className="latest-time" x={CHART.width - CHART.right} y={CHART.top - 18}>{formatAxisDate(latest.timestamp, true)} 更新</text>}
          </svg>
        ) : <div className="history-empty">继续运行组件一段时间后，这里会显示额度趋势。</div>}
      </section>
    </main>
  );
}
