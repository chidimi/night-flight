import { translate, type Locale } from './i18n.ts';
import type { FlightState } from './flight.ts';
import { enginePower } from './flight.ts';
const PAPER_COLOR = '#d8d0b5',
  INK_COLOR = '#171815';
export function createCockpit(canvas: HTMLCanvasElement) {
  const drawingContext = canvas.getContext('2d');
  if (!drawingContext) throw new Error('Canvas 2D is unavailable');
  const context = drawingContext;
  let viewportWidth = 0,
    viewportHeight = 0;
  function resize(width: number, height: number) {
    viewportWidth = width;
    viewportHeight = height;
    const pixelRatio = Math.min(2, devicePixelRatio || 1);
    canvas.width = viewportWidth * pixelRatio;
    canvas.height = viewportHeight * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
  function drawLine(
    x: number,
    y: number,
    X: number,
    Y: number,
    color = PAPER_COLOR,
    width = 1,
  ) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(X, Y);
    context.stroke();
  }
  function drawText(label: string | number, x: number, y: number, size = 10, alpha = 1) {
    context.globalAlpha = alpha;
    context.fillStyle = PAPER_COLOR;
    context.font = `${size}px 'Courier New',monospace`;
    context.textAlign = 'center';
    context.fillText(String(label), x, y);
    context.globalAlpha = 1;
  }
  function drawCircle(
    x: number,
    y: number,
    radius: number,
    fill?: string,
    stroke?: string,
  ) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1;
      context.stroke();
    }
  }
  function drawBezel(x: number, y: number, radius: number, label: string) {
    drawCircle(x, y, radius + 7, INK_COLOR, PAPER_COLOR);
    drawCircle(x, y, radius + 3, INK_COLOR, '#646355');
    drawCircle(x, y, radius, INK_COLOR, PAPER_COLOR);
    for (const angle of [0.8, 2.34, 3.94, 5.5]) {
      const X = x + Math.cos(angle) * (radius + 5),
        Y = y + Math.sin(angle) * (radius + 5);
      drawCircle(X, Y, 1.3, PAPER_COLOR);
    }
    drawText(label, x, y + radius * 0.59, Math.max(7, radius * 0.13), 0.75);
  }
  function drawGauge(
    x: number,
    y: number,
    radius: number,
    label: string,
    value: number,
    min: number,
    max: number,
    unit: string,
    format?: string | number,
  ) {
    drawBezel(x, y, radius, label);
    const start = -Math.PI * 0.77,
      end = Math.PI * 0.77;
    for (let i = 0; i <= 40; i++) {
      const angle = start + ((end - start) * i) / 40,
        major = i % 5 === 0;
      drawLine(
        x + Math.sin(angle) * radius * 0.9,
        y - Math.cos(angle) * radius * 0.9,
        x + Math.sin(angle) * radius * (major ? 0.72 : 0.8),
        y - Math.cos(angle) * radius * (major ? 0.72 : 0.8),
        PAPER_COLOR,
        major ? 1.2 : 0.6,
      );
      if (major && i > 0 && i < 40)
        drawText(
          Math.round(min + ((max - min) * i) / 40),
          x + Math.sin(angle) * radius * 0.57,
          y - Math.cos(angle) * radius * 0.57 + 3,
          Math.max(7, radius * 0.14),
        );
    }
    const angle =
      start + (end - start) * Math.max(0, Math.min(1, (value - min) / (max - min)));
    drawLine(
      x,
      y,
      x + Math.sin(angle) * radius * 0.68,
      y - Math.cos(angle) * radius * 0.68,
      PAPER_COLOR,
      2,
    );
    drawCircle(x, y, 3, PAPER_COLOR);
    drawText(
      format ?? Math.round(value),
      x,
      y + radius * 0.35,
      Math.max(9, radius * 0.18),
    );
    drawText(unit, x, y + radius * 0.76, Math.max(6, radius * 0.1), 0.55);
  }
  function drawAttitude(
    x: number,
    y: number,
    radius: number,
    state: FlightState,
    locale: Locale,
  ) {
    drawBezel(x, y, radius, 'ATTITUDE');
    context.save();
    context.beginPath();
    context.arc(x, y, radius * 0.9, 0, Math.PI * 2);
    context.clip();
    context.translate(x, y);
    context.rotate(state.bank);
    const horizonOffset = state.pitch * radius * 2.2;
    context.fillStyle = '#272920';
    context.fillRect(-radius, horizonOffset, radius * 2, radius * 2);
    drawLine(-radius, horizonOffset, radius, horizonOffset, PAPER_COLOR, 1.5);
    for (let j = -3; j <= 3; j++) {
      if (!j) continue;
      drawLine(
        -radius * 0.2,
        horizonOffset + j * radius * 0.22,
        radius * 0.2,
        horizonOffset + j * radius * 0.22,
        '#aaa48f',
        1,
      );
    }
    context.restore();
    drawLine(x - radius * 0.45, y, x - radius * 0.12, y, PAPER_COLOR, 2);
    drawLine(x + radius * 0.12, y, x + radius * 0.45, y, PAPER_COLOR, 2);
    drawLine(x - radius * 0.12, y, x, y + 5, PAPER_COLOR, 2);
    drawLine(x, y + 5, x + radius * 0.12, y, PAPER_COLOR, 2);
    drawText(
      translate(locale, 'level'),
      x,
      y + radius * 0.76,
      Math.max(7, radius * 0.12),
      0.65,
    );
  }
  function draw(state: FlightState, locale: Locale) {
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    // Keep portrait instruments readable, above the thumb controls.
    const portrait = viewportWidth < 600 && viewportHeight > viewportWidth;
    const scale = portrait
      ? Math.min(viewportWidth / 620, viewportHeight / 1100)
      : Math.min(viewportWidth / 1100, viewportHeight / 720);
    const dashboardTop = viewportHeight * (portrait ? 0.6 : 0.64);
    // Heavy window frame and angle gently arched dashboard.
    context.fillStyle = INK_COLOR;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(viewportWidth * 0.035, 0);
    context.lineTo(viewportWidth * 0.1, dashboardTop + 30);
    context.lineTo(0, viewportHeight);
    context.fill();
    context.beginPath();
    context.moveTo(viewportWidth, 0);
    context.lineTo(viewportWidth * 0.965, 0);
    context.lineTo(viewportWidth * 0.9, dashboardTop + 30);
    context.lineTo(viewportWidth, viewportHeight);
    context.fill();
    drawLine(
      viewportWidth * 0.035,
      0,
      viewportWidth * 0.1,
      dashboardTop + 30,
      '#555649',
      2,
    );
    drawLine(
      viewportWidth * 0.965,
      0,
      viewportWidth * 0.9,
      dashboardTop + 30,
      '#555649',
      2,
    );
    drawLine(0, 12, viewportWidth, 12, '#45473d', 2);
    context.beginPath();
    context.moveTo(0, viewportHeight);
    context.lineTo(0, dashboardTop + 35);
    context.quadraticCurveTo(
      viewportWidth * 0.5,
      dashboardTop - 48,
      viewportWidth,
      dashboardTop + 35,
    );
    context.lineTo(viewportWidth, viewportHeight);
    context.closePath();
    context.fill();
    context.strokeStyle = '#767462';
    context.stroke();
    const radius = 61 * scale,
      smallRadius = 43 * scale,
      y = dashboardTop + 75 * scale,
      spacing = 166 * scale;
    drawGauge(
      viewportWidth / 2 - spacing,
      y,
      radius,
      'AIRSPEED',
      state.speed * 1.94384,
      0,
      160,
      'KNOTS',
    );
    drawAttitude(viewportWidth / 2, y, radius, state, locale);
    drawGauge(
      viewportWidth / 2 + spacing,
      y,
      radius,
      'ALTITUDE',
      state.altitude,
      0,
      2400,
      'METRES',
    );
    const lowerRowY = y + 122 * scale;
    drawGauge(
      viewportWidth / 2 - spacing * 0.72,
      lowerRowY,
      smallRadius,
      'HEADING',
      (state.heading * 180) / Math.PI,
      0,
      360,
      'DEGREES',
      String(Math.round((state.heading * 180) / Math.PI)).padStart(3, '0'),
    );
    drawGauge(
      viewportWidth / 2 + spacing * 0.72,
      lowerRowY,
      smallRadius,
      'CLIMB',
      state.vertical,
      -15,
      15,
      'M / S',
      state.vertical.toFixed(1),
    );
    drawGauge(
      viewportWidth / 2,
      lowerRowY,
      smallRadius,
      'FUEL',
      state.fuel * 100,
      0,
      100,
      '%',
      Math.ceil(state.fuel * 100),
    );
    const power = enginePower(state);
    const powerX = portrait ? viewportWidth - 20 : viewportWidth / 2 + spacing * 2.05;
    drawLine(powerX, y - 15 * scale, powerX, y + 85 * scale, '#777463', 3);
    const powerY = y + 85 * scale - power * 100 * scale;
    drawLine(powerX - 9 * scale, powerY, powerX + 9 * scale, powerY, PAPER_COLOR, 5);
    drawText('POWER', powerX, y + 109 * scale, 8 * scale, 0.65);
    drawText(`${Math.round(power * 100)}%`, powerX, y + 125 * scale, 10 * scale);
    drawText(
      'N F  —  0 1',
      viewportWidth / 2 - spacing * 2.05,
      y + 30 * scale,
      10 * scale,
      0.65,
    );
    drawText('NIGHT FLIGHT', viewportWidth / 2, viewportHeight - 15, 9, 0.35);
  }
  return { resize, draw };
}
