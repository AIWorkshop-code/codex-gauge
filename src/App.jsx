import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BASE_WIDTH = 400;
const BASE_HEIGHT = 160;
const RENDER_SCALE = 3;

const PREVIEW_SNAPSHOT = {
  available: true,
  secondaryRemaining: 42,
  secondaryResetsAt: Math.floor(Date.now() / 1000) + 4 * 24 * 3600 + 8 * 3600,
};

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function formatPercent(value) {
  const number = clamp(value);
  return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`;
}

function formatCountdown(resetsAt, now) {
  if (!resetsAt) return "--";
  const remaining = Math.max(0, Math.floor(resetsAt - now / 1000));
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  if (days > 0) return `${days}天 ${String(hours % 24).padStart(2, "0")}时`;
  if (hours > 0) return `${hours}时 ${String(minutes).padStart(2, "0")}分`;
  if (minutes > 0) return `${minutes}分 ${String(seconds).padStart(2, "0")}秒`;
  return `${seconds}秒`;
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawClock(context, x, y, color) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.lineCap = "round";
  context.beginPath();
  context.arc(x, y, 8.5, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x, y - 5);
  context.moveTo(x, y);
  context.lineTo(x + 4.6, y);
  context.stroke();
  context.restore();
}

function mixValue(from, to, amount) {
  if (to.text === "--") return to;
  const remaining = from.remaining + (to.remaining - from.remaining) * amount;
  return { remaining, text: formatPercent(remaining) };
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

function drawWidget(canvas, value, countdown, loading, isDark, animation = {}) {
  if (!canvas) return;
  const context = canvas.getContext("2d", { alpha: false });
  const emphasis = animation.emphasis || 0;
  const palette = isDark ? {
    surfaceStart: "#202725",
    surfaceMid: "#1a211f",
    surfaceEnd: "#151b19",
    text: "#f2f7f4",
    muted: "#aab8b1",
    track: "rgba(219, 236, 227, 0.13)",
    badge: "rgba(86, 219, 149, 0.13)",
    badgeText: "#79e0aa",
    border: "rgba(255, 255, 255, 0.09)",
    shadow: "rgba(0, 0, 0, 0.46)",
    glow: "rgba(58, 210, 129, 0.15)",
    shimmer: "rgba(255, 255, 255, 0.45)",
  } : {
    surfaceStart: "#fbfdfc",
    surfaceMid: "#f5faf7",
    surfaceEnd: "#eef7f2",
    text: "#18211d",
    muted: "#65736c",
    track: "rgba(36, 63, 49, 0.12)",
    badge: "rgba(45, 177, 106, 0.11)",
    badgeText: "#168d53",
    border: "rgba(255, 255, 255, 0.94)",
    shadow: "rgba(26, 65, 46, 0.16)",
    glow: "rgba(61, 208, 132, 0.17)",
    shimmer: "rgba(255, 255, 255, 0.9)",
  };

  context.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  context.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  const surface = context.createLinearGradient(0, 0, BASE_WIDTH, BASE_HEIGHT);
  surface.addColorStop(0, palette.surfaceStart);
  surface.addColorStop(0.58, palette.surfaceMid);
  surface.addColorStop(1, palette.surfaceEnd);
  context.fillStyle = surface;
  context.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  context.save();
  context.globalAlpha = loading ? 0.88 : 1;
  context.shadowColor = palette.shadow;
  context.shadowBlur = 16 + emphasis * 5;
  context.shadowOffsetY = 6 + emphasis * 2;
  roundedRect(context, 8, 8, 384, 144, 23);
  context.fillStyle = surface;
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = palette.border;
  context.lineWidth = 1;
  context.stroke();

  context.save();
  roundedRect(context, 9, 9, 382, 142, 22);
  context.clip();
  const glow = context.createRadialGradient(345, 2, 0, 345, 2, 175);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(0.6, "rgba(65, 208, 134, 0.04)");
  glow.addColorStop(1, "rgba(65, 208, 134, 0)");
  context.fillStyle = glow;
  context.fillRect(180, 0, 220, 150);
  context.restore();

  roundedRect(context, 28, 25, 51, 30, 15);
  context.fillStyle = palette.badge;
  context.fill();
  context.fillStyle = palette.badgeText;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.font = '650 16px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText("7D", 53.5, 46);

  context.fillStyle = palette.muted;
  context.textAlign = "left";
  context.font = '520 17px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText("本周剩余", 92, 47);

  context.fillStyle = palette.text;
  context.textAlign = "right";
  context.font = '600 38px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText(value.text, 371, 58);

  const progressX = 28;
  const progressY = 87;
  const progressWidth = 344;
  context.lineWidth = 9;
  context.lineCap = "round";
  context.strokeStyle = palette.track;
  context.beginPath();
  context.moveTo(progressX, progressY);
  context.lineTo(progressX + progressWidth, progressY);
  context.stroke();

  if (value.remaining > 0 && value.text !== "--") {
    const endpointX = progressX + progressWidth * (value.remaining / 100);
    const barGradient = context.createLinearGradient(progressX, 0, progressX + progressWidth, 0);
    barGradient.addColorStop(0, "#159457");
    barGradient.addColorStop(0.56, "#31b66f");
    barGradient.addColorStop(1, "#6bd79e");
    context.strokeStyle = barGradient;
    context.shadowColor = `rgba(43, 183, 109, ${0.35 * emphasis})`;
    context.shadowBlur = 11 * emphasis;
    context.beginPath();
    context.moveTo(progressX, progressY);
    context.lineTo(endpointX, progressY);
    context.stroke();
    context.shadowColor = "transparent";

    context.fillStyle = "#77dda7";
    context.globalAlpha = 0.35 + emphasis * 0.65;
    context.beginPath();
    context.arc(endpointX, progressY, 3.4 + emphasis * 1.4, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;

    if (animation.ambient > 0) {
      context.fillStyle = `rgba(130, 237, 179, ${0.85 * animation.ambient})`;
      context.shadowColor = `rgba(64, 221, 137, ${0.75 * animation.ambient})`;
      context.shadowBlur = 17;
      context.beginPath();
      context.arc(endpointX, progressY, 4 + animation.ambient * 2.6, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = "transparent";
    }
  }

  if (loading) {
    const shimmerX = progressX + ((animation.phase || 0) * (progressWidth + 44)) - 22;
    const shimmer = context.createLinearGradient(shimmerX - 22, 0, shimmerX + 22, 0);
    shimmer.addColorStop(0, "rgba(255,255,255,0)");
    shimmer.addColorStop(0.5, palette.shimmer);
    shimmer.addColorStop(1, "rgba(255,255,255,0)");
    context.strokeStyle = shimmer;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(Math.max(progressX, shimmerX - 22), progressY);
    context.lineTo(Math.min(progressX + progressWidth, shimmerX + 22), progressY);
    context.stroke();
  }

  drawClock(context, 37, 124, palette.muted);
  context.fillStyle = palette.muted;
  context.textAlign = "left";
  context.font = '450 20px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText(`${countdown} 后重置`, 55, 131);
  context.restore();
}

export function App() {
  const canvasRef = useRef(null);
  const displayedValueRef = useRef({ remaining: 0, text: "0%" });
  const animationFrameRef = useRef(null);
  const renderedAmbientTickRef = useRef(0);
  const [snapshot, setSnapshot] = useState(() => (
    window.codexQuota?.read ? { available: false } : PREVIEW_SNAPSHOT
  ));
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [ambientTick, setAmbientTick] = useState(0);
  const [isDark, setIsDark] = useState(() => (
    window.matchMedia?.("(prefers-color-scheme: dark)").matches || false
  ));

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = (event) => setIsDark(event.matches);
    colorScheme.addEventListener("change", updateTheme);
    return () => colorScheme.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    const firstPulse = window.setTimeout(() => setAmbientTick((tick) => tick + 1), 1600);
    const pulseTimer = window.setInterval(() => setAmbientTick((tick) => tick + 1), 6500);
    return () => {
      window.clearTimeout(firstPulse);
      window.clearInterval(pulseTimer);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (window.codexQuota?.read) setSnapshot(await window.codexQuota.read());
      else setSnapshot(PREVIEW_SNAPSHOT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const removeRefreshListener = window.codexQuota?.onRefresh?.(refresh);
    const removeUpdatedListener = window.codexQuota?.onUpdated?.((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setLoading(false);
    });
    const refreshTimer = window.setInterval(refresh, 30_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      removeRefreshListener?.();
      removeUpdatedListener?.();
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [refresh]);

  const value = useMemo(() => {
    if (!snapshot?.available) return { remaining: 0, text: "--" };
    return {
      remaining: clamp(snapshot.secondaryRemaining),
      text: formatPercent(snapshot.secondaryRemaining),
    };
  }, [snapshot]);

  const countdown = formatCountdown(snapshot?.secondaryResetsAt, now);
  const accessibilityLabel = snapshot?.available
    ? `Codex 7天额度剩余 ${formatPercent(snapshot.secondaryRemaining)}，将在 ${countdown} 后重置`
    : "Codex 7天额度状态暂时不可用";

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = displayedValueRef.current;
    const startedAt = performance.now();
    const hasValueChange = from.remaining !== value.remaining || from.text !== value.text;
    const isAmbientPulse = ambientTick > renderedAmbientTickRef.current && !hasValueChange;
    renderedAmbientTickRef.current = ambientTick;
    const duration = reduceMotion ? 0 : (hasValueChange ? 1300 : (isAmbientPulse ? 900 : 0));

    const render = (timestamp) => {
      const elapsed = timestamp - startedAt;
      const rawProgress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
      const progress = easeOutCubic(rawProgress);
      const displayed = mixValue(from, value, progress);
      displayedValueRef.current = displayed;
      drawWidget(canvasRef.current, displayed, countdown, loading, isDark, {
        emphasis: hasValueChange ? Math.sin(rawProgress * Math.PI) : 0,
        ambient: isAmbientPulse ? Math.sin(rawProgress * Math.PI) : 0,
        phase: (elapsed % 1100) / 1100,
      });

      if (rawProgress < 1 || loading) {
        animationFrameRef.current = window.requestAnimationFrame(render);
      } else {
        displayedValueRef.current = value;
      }
    };

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animationFrameRef.current);
  }, [value, countdown, loading, isDark, ambientTick]);

  const handleContextMenu = (event) => {
    event.preventDefault();
    window.codexQuota?.showMenu?.();
  };

  return (
    <main className="widget-shell" onContextMenu={handleContextMenu}>
      <canvas
        ref={canvasRef}
        className="widget-canvas"
        width={BASE_WIDTH * RENDER_SCALE}
        height={BASE_HEIGHT * RENDER_SCALE}
        aria-label={accessibilityLabel}
      />
      <div className="drag-surface" aria-hidden="true" />
    </main>
  );
}
