import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BASE_WIDTH = 440;
const BASE_HEIGHT = 194;
const RENDER_SCALE = 3;

const PREVIEW_SNAPSHOT = {
  available: true,
  primaryRemaining: 68,
  secondaryRemaining: 42,
  primaryResetsAt: Math.floor(Date.now() / 1000) + 2 * 3600 + 18 * 60,
};

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function formatPercent(value) {
  const number = clamp(value);
  return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`;
}

function formatCountdown(resetsAt, now) {
  if (!resetsAt) return "--:--";
  const remaining = Math.max(0, Math.floor(resetsAt - now / 1000));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const seconds = remaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawClock(context, x, y) {
  context.save();
  context.strokeStyle = "#272b2e";
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

function drawWidget(canvas, values, countdown, loading) {
  if (!canvas) return;
  const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  context.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  context.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  context.fillStyle = "#f2f6f7";
  context.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  context.save();
  context.globalAlpha = loading ? 0.82 : 1;
  context.shadowColor = "rgba(25, 45, 58, 0.14)";
  context.shadowBlur = 17;
  context.shadowOffsetY = 7;
  roundedRect(context, 8, 8, 424, 178, 22);
  context.fillStyle = "#f2f6f7";
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 1;
  context.stroke();

  const circleX = 116;
  const circleY = 97;
  const radius = 68;
  context.lineWidth = 5;
  context.lineCap = "round";
  context.strokeStyle = "rgba(42, 52, 60, 0.12)";
  context.beginPath();
  context.arc(circleX, circleY, radius, 0, Math.PI * 2);
  context.stroke();
  if (values.primary > 0) {
    context.strokeStyle = "#2da867";
    context.beginPath();
    context.arc(
      circleX,
      circleY,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * (values.primary / 100),
    );
    context.stroke();
  }

  context.fillStyle = "#141719";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.font = '430 26px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText("5H", circleX, 91);
  context.font = '430 28px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText(values.primaryText, circleX, 123);

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
  context.strokeStyle = "rgba(42, 52, 60, 0.16)";
  context.beginPath();
  context.moveTo(rightX, progressY);
  context.lineTo(rightEdge, progressY);
  context.stroke();
  if (values.secondary > 0) {
    context.strokeStyle = "#2da867";
    context.beginPath();
    context.moveTo(rightX, progressY);
    context.lineTo(rightX + progressWidth * (values.secondary / 100), progressY);
    context.stroke();
  }

  drawClock(context, 246, 143);
  context.fillStyle = "#272b2e";
  context.textAlign = "left";
  context.font = '420 26px "Segoe UI Variable", "Segoe UI", sans-serif';
  context.fillText(countdown, 270, 152);
  context.restore();
}

export function App() {
  const canvasRef = useRef(null);
  const [snapshot, setSnapshot] = useState(() => (
    window.codexQuota?.read ? { available: false } : PREVIEW_SNAPSHOT
  ));
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

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

  const countdown = formatCountdown(snapshot?.primaryResetsAt, now);
  useEffect(() => {
    drawWidget(canvasRef.current, values, countdown, loading);
  }, [values, countdown, loading]);

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
        aria-label="Codex quota status"
      />
      <div className="drag-surface" aria-hidden="true" />
    </main>
  );
}
