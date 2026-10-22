import './style.css';
import {
  initialLocale,
  isLocale,
  saveLocale,
  translate,
  translateDocument,
  type MessageKey,
} from './i18n.ts';
let locale = initialLocale();
let errorKey: MessageKey | undefined;
import { createTouchControls } from './touch-controls.ts';
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

const languageControl = requireElement('#language', HTMLSelectElement);
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
  errorKey = 'webglError';
  startButton.disabled = true;
  console.error(error);
}

const cockpit = createCockpit(cockpitCanvas);
const sound = new Propeller();
const updateReadings = createInstrumentReadings(
  requireElement('#readings', HTMLDivElement),
);
const touchContainer = requireElement('#touch-controls', HTMLDivElement);
const touch = createTouchControls(
  touchContainer,
  requireElement('#stick', HTMLDivElement),
);
const pressedKeys = new Set<string>();
let flight = createFlight();
let mode: FlightMode = 'ready';
let previousFrame = 0;
let accumulator = 0;

function resize(): void {
  touch.reset();
  world?.resize(innerWidth, innerHeight);
  cockpit.resize(innerWidth, innerHeight);
}

function updateLanguage(): void {
  translateDocument(locale);
  languageControl.value = locale;
  const screen = mode === 'ended' ? 'ended' : mode === 'paused' ? 'paused' : 'ready';
  title.textContent = translate(locale, `${screen}Title`);
  intro.textContent = translate(locale, `${screen}Intro`);
  const label = translate(
    locale,
    screen === 'ready' ? 'start' : screen === 'paused' ? 'resume' : 'restart',
  );
  const arrow = document.createElement('span');
  arrow.textContent = '→';
  arrow.setAttribute('aria-hidden', 'true');
  startButton.replaceChildren(document.createTextNode(label + ' '), arrow);
  errorMessage.textContent = errorKey ? translate(locale, errorKey) : '';
  updateReadings(flight, locale);
  cockpit.draw(flight, locale);
}

function showOverlay(): void {
  pressedKeys.clear();
  touch.reset();
  touchContainer.hidden = true;
  overlay.classList.remove('hidden');
  updateLanguage();
}

function pause(): void {
  if (mode !== 'flying') return;
  mode = 'paused';
  showOverlay();
  sound.update(flight, false);
}

async function startFlight(): Promise<void> {
  try {
    await sound.init();
  } catch {
    errorKey = 'audioError';
    updateLanguage();
  }
  if (mode === 'ended') flight = createFlight();
  mode = 'flying';
  accumulator = 0;
  pressedKeys.clear();
  touch.reset();
  overlay.classList.add('hidden');
  touchContainer.hidden = false;
  startButton.blur();
}

function readInput(): FlightInput {
  return {
    roll: Math.max(
      -1,
      Math.min(
        1,
        Number(pressedKeys.has('ArrowRight')) -
          Number(pressedKeys.has('ArrowLeft')) +
          touch.input.roll,
      ),
    ),
    pitch: Math.max(
      -1,
      Math.min(
        1,
        Number(pressedKeys.has('ArrowDown')) -
          Number(pressedKeys.has('ArrowUp')) +
          touch.input.pitch,
      ),
    ),
    power: Math.max(
      -1,
      Math.min(
        1,
        Number(pressedKeys.has('KeyW')) -
          Number(pressedKeys.has('KeyS')) +
          touch.input.power,
      ),
    ),
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
    showOverlay();
  }
}

function frame(now: number): void {
  const elapsedSeconds = Math.min(MAX_FRAME_SECONDS, (now - previousFrame) / 1000);
  previousFrame = now;
  if (mode === 'flying') advanceFlight(elapsedSeconds);
  sound.update(flight, mode === 'flying');
  world?.draw(flight);
  cockpit.draw(flight, locale);
  updateReadings(flight, locale);
  requestAnimationFrame(frame);
}

languageControl.addEventListener('change', () => {
  if (!isLocale(languageControl.value)) return;
  locale = languageControl.value;
  saveLocale(locale);
  updateLanguage();
});

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
updateLanguage();
resize();
requestAnimationFrame(frame);
