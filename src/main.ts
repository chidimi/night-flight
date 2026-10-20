import './style.css';
import { createInstrumentReadings } from './instruments.ts';
import { createFlight, step, type FlightInput } from './flight.ts';
import { createWorld } from './world.ts';
import { createCockpit } from './cockpit.ts';
import { Propeller } from './audio.ts';

type FlightMode = 'ready' | 'flying' | 'paused' | 'ended';
const FIXED_STEP_SECONDS = 1 / 60;
const MAX_FRAME_SECONDS = 0.1;
const FLIGHT_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'KeyW',
  'KeyS',
]);

function requireElement<T extends Element>(
  selector: string,
  elementType: { new (): T },
): T {
  const element = document.querySelector(selector);
  if (!(element instanceof elementType)) {
    throw new Error(`Missing or invalid element: ${selector}`);
  }
  return element;
}

const overlay = requireElement('#overlay', HTMLDivElement);
const startButton = requireElement('#start', HTMLButtonElement);
const menuButton = requireElement('#menu', HTMLButtonElement);
const volumeControl = requireElement('#volume', HTMLInputElement);
const title = requireElement('h1', HTMLHeadingElement);
const intro = requireElement('#intro', HTMLParagraphElement);
const errorMessage = requireElement('#error', HTMLParagraphElement);
const worldCanvas = requireElement('#world', HTMLCanvasElement);
const cockpitCanvas = requireElement('#cockpit', HTMLCanvasElement);

let world: ReturnType<typeof createWorld> | undefined;
try {
  world = createWorld(worldCanvas);
} catch (error) {
  errorMessage.textContent =
    '3D描画を開始できません。WebGLが使えるブラウザで開いてください。';
  startButton.disabled = true;
  console.error(error);
}

const cockpit = createCockpit(cockpitCanvas);
const sound = new Propeller();
const updateReadings = createInstrumentReadings(
  requireElement('#readings', HTMLDivElement),
);
const pressedKeys = new Set<string>();
let flight = createFlight();
let mode: FlightMode = 'ready';
let previousFrame = 0;
let accumulator = 0;

function resize(): void {
  world?.resize(innerWidth, innerHeight);
  cockpit.resize(innerWidth, innerHeight);
}

function showOverlay(heading: string, description: string, buttonLabel: string): void {
  pressedKeys.clear();
  overlay.classList.remove('hidden');
  title.textContent = heading;
  intro.innerHTML = description;
  startButton.innerHTML = `${buttonLabel} <span>→</span>`;
}

function pause(): void {
  if (mode !== 'flying') return;
  mode = 'paused';
  showOverlay(
    '夜は、ここに。',
    '飛行を一時停止しています。<br>同じ空から、続きを。',
    '飛行に戻る',
  );
  sound.update(flight, false);
}

async function startFlight(): Promise<void> {
  try {
    await sound.init();
  } catch {
    errorMessage.textContent = '音を開始できませんでした。無音で飛行できます。';
  }
  if (mode === 'ended') flight = createFlight();
  mode = 'flying';
  accumulator = 0;
  pressedKeys.clear();
  overlay.classList.add('hidden');
  startButton.blur();
}

function readInput(): FlightInput {
  return {
    roll: Number(pressedKeys.has('ArrowRight')) - Number(pressedKeys.has('ArrowLeft')),
    pitch: Number(pressedKeys.has('ArrowDown')) - Number(pressedKeys.has('ArrowUp')),
    power: Number(pressedKeys.has('KeyW')) - Number(pressedKeys.has('KeyS')),
  };
}

function advanceFlight(elapsedSeconds: number): void {
  accumulator += elapsedSeconds;
  const input = readInput();
  while (accumulator >= FIXED_STEP_SECONDS) {
    step(flight, input, FIXED_STEP_SECONDS);
    accumulator -= FIXED_STEP_SECONDS;
  }
  if (flight.ended) {
    mode = 'ended';
    showOverlay(
      '飛行のあと。',
      'プロペラは止まりました。<br>夜は、続いています。',
      'もう一度、空へ',
    );
  }
}

function frame(now: number): void {
  const elapsedSeconds = Math.min(MAX_FRAME_SECONDS, (now - previousFrame) / 1000);
  previousFrame = now;
  if (mode === 'flying') advanceFlight(elapsedSeconds);
  sound.update(flight, mode === 'flying');
  world?.draw(flight);
  cockpit.draw(flight);
  updateReadings(flight);
  requestAnimationFrame(frame);
}

startButton.addEventListener('click', () => {
  void startFlight();
});
menuButton.addEventListener('click', pause);
volumeControl.addEventListener('input', () => {
  sound.volume = Number(volumeControl.value);
});
addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.code === 'Escape') {
    if (mode === 'flying') pause();
    else if (mode === 'paused') startButton.click();
    return;
  }
  if (mode === 'flying' && FLIGHT_KEYS.has(event.code)) {
    event.preventDefault();
    pressedKeys.add(event.code);
  }
});
addEventListener('keyup', (event: KeyboardEvent) => {
  pressedKeys.delete(event.code);
});
addEventListener('blur', pause);
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
resize();
requestAnimationFrame(frame);
