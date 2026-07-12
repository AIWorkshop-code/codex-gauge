import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BASE_WIDTH = 440;
const BASE_HEIGHT = 194;
const RENDER_SCALE = 3;

const PREVIEW_SNAPSHOT = {
  available: true,
  primaryRemaining: 68,
  secondaryRemaining: 42,
  primaryResetsAt: Math.floor(Date.now() / 1000) + 2 * 3600 + 18 * 60,
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
  context.lineWidth = 2.2;
  context.lineCap = "round";
  context.beginPath();
  context.arc(x, y, 9.5, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x, y - 5.7);
  context.moveTo(x, y);
  context.lineTo(x + 5.2, y);
  context.stroke();
  context.restore();
}

function mixValues(from, to, amount) {
  if (to.primaryText === "--") return to;
  const primary = from.primary + (to.primary - from.primary) * amount;
  const secondary = from.secondary + (to.secondary - from.secondary) * amount;
  return {
    primary,
    secondary,
    primaryText: formatPercent(primary),
    secondaryText: formatPercent(secondary),
  };
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

function drawWidget(canvas, values, countdown, loading, isDark, primaryOnly, animation = {}) {
  if (!canvas) return;
  const context = canvas.getContext("2d", { alpha: false });
  const emphasis = animation.emphasis || 0;
  const surfaceWidth = primaryOnly ? BASE_HEIGHT : BASE_WIDTH;
  const palette = isDark ? {
    surfaceStart: "#202628",
    surfaceMid: "#1b2022",
    surfaceEnd: "#15191b",
    text: "#f1f5f3",
    secondaryText: "#d8dfdc",
    track: "rgba(215, 226, 222, 0.16)",
    border: "rgba(255, 255, 255, 0.09)",
    shadow: "rgba(0, 0, 0, 0.48)",
    shimmer: "rgba(255,255,255,0.48)",
  } : {
    surfaceStart: "#f7fafb",
    surfaceMid: "#f2f6f7",
    surfaceEnd: "#edf3f4",
    text: "#141719",
    secondaryText: "#272b2e",
    track: "rgba(42, 52, 60, 0.14)",
    border: "rgba(255, 255, 255, 0.9)",
    shadow: "rgba(25, 45, 58, 0.14)",
    shimmer: "rgba(255,255,255,0.82)",
  };
  context.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  context.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  const surface = context.createLinearGradient(0, 0, surfaceWidth, BASE_HEIGHT);
  surface.addColorStop(0, palette.surfaceStart);
  surface.addColorStop(0.55, palette.surfaceMid);
  surface.addColorStop(1, palette.surfaceEnd);
  context.fillStyle = surface;
  context.fillRect(0, 0, surfaceWidth, BASE_HEIGHT);

  context.save();
  context.globalAlpha = loading ? 0.88 : 1;
  context.shadowColor = palette.shadow;
  context.shadowBlur = 17 + emphasis * 5;
  context.shadowOffsetY = 7 + emphasis * 2;
  roundedRect(context, 8, 8, primaryOnly ? 178 : 424, 178, 22);
  context.fillStyle = surface;
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = palette.border;
  context.lineWidth = 1;
  context.stroke();

  const circleX = primaryOnly ? 97 : 116;
  const circleY = 97;
  const radius = 68;
  context.lineWidth = 5;
  context.lineCap = "round";
  context.strokeStyle = palette.track;
  context.beginPath();
  context.arc(circleX, circleY, radius, 0, Math.PI * 2);
  context.stroke();
  if (values.primary > 0) {
    const ringGradient = context.createLinearGradient(48, 30, 178, 164);
    ringGradient.addColorStop(0, "#5bcf91");
    ringGradient.addColorStop(0.55, "#2caf6d");
    ringGradient.addColorStop(1, "#179158");
    context.strokeStyle = ringGradient;
    context.shadowColor = `rgba(45, 174, 108, ${0.3 * emphasis})`;
    context.shadowBlur = 12 * emphasis;
    context.beginPath();
    context.arc(
      circleX,
      circleY,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * (values.primary / 100),
    );
    context.stroke();
    context.shadowColor = "transparent";

    const endAngle = -Math.PI / 2 + Math.PI * 2 * (values.primary / 100);
    context.fillStyle = "#63d69a";
    context.globalAlpha = 0.25 + emphasis * 0.75;
    context.beginPath();
    context.arc(
      circleX + Math.cos(endAngle) * radius,
      circleY + Math.sin(endAngle) * radius,
      3.1 + emphasis * 1.4,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.globalAlpha = 1;

    if (animation.ambient > 0) {
      const sweepAngle = endAngle - 0.5 + animation.phase * 0.75;
      context.strokeStyle = `rgba(132, 245, 185, ${0.85 * animation.ambient})`;
      context.lineWidth = 7;
      context.shadowColor = `rgba(73, 224, 143, ${0.75 * animation.ambient})`;
      context.shadowBlur = 18;
      context.beginPath();
      context.arc(circleX, circleY, radius, sweepAngle - 0.18, sweepAngle + 0.18);
      context.stroke();
      context.shadowColor = "transparent";
    }
  }

  context.fillStyle = palette.text;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.font = '430 26px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText("5H", circleX, 91);
  context.font = '430 28px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText(values.primaryText, circleX, 123);

  if (primaryOnly) {
    context.restore();
    return;
  }

  const rightX = 230;
  const rightEdge = 412;
  context.textAlign = "left";
  context.font = '430 26px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText("7D", rightX, 76);
  context.textAlign = "right";
  context.fillText(values.secondaryText, rightEdge, 76);

  const progressY = 99;
  const progressWidth = rightEdge - rightX;
  context.lineWidth = 6;
  context.lineCap = "round";
  context.strokeStyle = palette.track;
  context.beginPath();
  context.moveTo(rightX, progressY);
  context.lineTo(rightEdge, progressY);
  context.stroke();
  if (values.secondary > 0) {
    const barGradient = context.createLinearGradient(rightX, 0, rightEdge, 0);
    barGradient.addColorStop(0, "#239e61");
    barGradient.addColorStop(1, "#61d397");
    context.strokeStyle = barGradient;
    context.shadowColor = `rgba(45, 174, 108, ${0.3 * emphasis})`;
    context.shadowBlur = 10 * emphasis;
    context.beginPath();
    context.moveTo(rightX, progressY);
    context.lineTo(rightX + progressWidth * (values.secondary / 100), progressY);
    context.stroke();
    context.shadowColor = "transparent";

    if (animation.ambient > 0) {
      const endpointX = rightX + progressWidth * (values.secondary / 100);
      context.fillStyle = `rgba(117, 235, 171, ${0.9 * animation.ambient})`;
      context.shadowColor = `rgba(66, 219, 136, ${0.8 * animation.ambient})`;
      context.shadowBlur = 16;
      context.beginPath();
      context.arc(endpointX, progressY, 4 + animation.ambient * 2.5, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = "transparent";
    }
  }

  if (loading) {
    const shimmerX = rightX + ((animation.phase || 0) * (progressWidth + 42)) - 21;
    const shimmer = context.createLinearGradient(shimmerX - 20, 0, shimmerX + 20, 0);
    shimmer.addColorStop(0, "rgba(255,255,255,0)");
    shimmer.addColorStop(0.5, palette.shimmer);
    shimmer.addColorStop(1, "rgba(255,255,255,0)");
    context.strokeStyle = shimmer;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(Math.max(rightX, shimmerX - 20), progressY);
    context.lineTo(Math.min(rightEdge, shimmerX + 20), progressY);
    context.stroke();
  }

  drawClock(context, 246, 143, palette.secondaryText);
  context.fillStyle = palette.secondaryText;
  context.textAlign = "left";
  context.font = '420 26px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText(countdown, 270, 152);
  context.restore();
}

export function App() {
  const canvasRef = useRef(null);
  const displayedValuesRef = useRef({ primary: 0, secondary: 0, primaryText: "0%", secondaryText: "0%" });
  const animationFrameRef = useRef(null);
  const renderedAmbientTickRef = useRef(0);
  const [snapshot, setSnapshot] = useState(() => (
    window.codexQuota?.read ? { available: false } : PREVIEW_SNAPSHOT
  ));
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [ambientTick, setAmbientTick] = useState(0);
  const [preferences, setPreferences] = useState({ countdownWindow: "primary" });
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
    window.codexQuota?.readPreferences?.().then(setPreferences);
    return window.codexQuota?.onPreferencesUpdated?.(setPreferences);
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

  const values = useMemo(() => {
    if (!snapshot?.available) {
      return { primary: 0, secondary: 0, primaryText: "--", secondaryText: "--" };
    }
    return {
      primary: clamp(snapshot.primaryRemaining),
      secondary: clamp(snapshot.secondaryRemaining),
      primaryText: formatPercent(snapshot.primaryRemaining),
      secondaryText: formatPercent(snapshot.secondaryRemaining),
    };
  }, [snapshot]);

  const countdownTarget = preferences.countdownWindow === "secondary"
    ? snapshot?.secondaryResetsAt
    : snapshot?.primaryResetsAt;
  const countdown = formatCountdown(countdownTarget, now);
  const countdownLabel = preferences.countdownWindow === "secondary" ? "7天" : "5小时";
  const accessibilityLabel = snapshot?.available
    ? `Codex 额度状态，5小时剩余 ${formatPercent(snapshot.primaryRemaining)}，7天剩余 ${formatPercent(snapshot.secondaryRemaining)}，${countdownLabel}额度将在 ${countdown} 后重置`
    : "Codex 额度状态暂时不可用";
  const primaryOnly = preferences.displayMode === "primary";
  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = displayedValuesRef.current;
    const startedAt = performance.now();
    const hasValueChange = from.primary !== values.primary
      || from.secondary !== values.secondary
      || from.primaryText !== values.primaryText
      || from.secondaryText !== values.secondaryText;
    const isAmbientPulse = ambientTick > renderedAmbientTickRef.current && !hasValueChange;
    renderedAmbientTickRef.current = ambientTick;
    const duration = reduceMotion ? 0 : (hasValueChange ? 1300 : (isAmbientPulse ? 900 : 0));

    const render = (timestamp) => {
      const elapsed = timestamp - startedAt;
      const rawProgress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
      const progress = easeOutCubic(rawProgress);
      const displayed = mixValues(from, values, progress);
      displayedValuesRef.current = displayed;
      drawWidget(canvasRef.current, displayed, countdown, loading, isDark, primaryOnly, {
        emphasis: hasValueChange ? Math.sin(rawProgress * Math.PI) : 0,
        ambient: isAmbientPulse ? Math.sin(rawProgress * Math.PI) : 0,
        phase: (elapsed % 1100) / 1100,
      });

      if (rawProgress < 1 || loading) {
        animationFrameRef.current = window.requestAnimationFrame(render);
      } else {
        displayedValuesRef.current = values;
      }
    };

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animationFrameRef.current);
  }, [values, countdown, loading, isDark, ambientTick, primaryOnly]);

  const handleContextMenu = (event) => {
    event.preventDefault();
    window.codexQuota?.showMenu?.();
  };

  return (
    <main className={`widget-shell${primaryOnly ? " primary-only" : ""}`} onContextMenu={handleContextMenu}>
      <canvas
        ref={canvasRef}
        className="widget-canvas"
        width={(primaryOnly ? BASE_HEIGHT : BASE_WIDTH) * RENDER_SCALE}
        height={BASE_HEIGHT * RENDER_SCALE}
        aria-label={accessibilityLabel}
      />
      <div className="drag-surface" aria-hidden="true" />
    </main>
  );
}
