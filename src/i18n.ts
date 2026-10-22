export type Locale = 'ja' | 'en';

const ja = {
  pageTitle: '夜間飛行 — Night Flight',
  sky: '夜の空',
  cockpit: '飛行計器',
  readings: '計器の読み取り',
  pauseMenu: '一時停止と操作説明',
  touchControls: 'タッチ操縦',
  stickDescription: '操縦桿：左右でバンク、上で機首下げ、下で機首上げ',
  stick: '操縦桿',
  power: '出力',
  powerUp: '出力を上げる',
  powerDown: '出力を下げる',
  bankHelp: '機体を左右に傾ける',
  pitchHelp: '機首を下げる / 上げる',
  powerHelp: '出力を上げる / 下げる',
  pause: '一時停止',
  readyTitle: '夜のなかへ。',
  readyIntro: '星が見えなくても、針は動いている。\n小さな機体と、夜を飛ぶ。',
  start: '飛びはじめる',
  pausedTitle: '夜は、ここに。',
  pausedIntro: '飛行を一時停止しています。\n同じ空から、続きを。',
  resume: '飛行に戻る',
  endedTitle: '飛行のあと。',
  endedIntro: 'プロペラは止まりました。\n夜は、続いています。',
  restart: 'もう一度、空へ',
  touchHelp:
    '左の操縦桿：左右で機体を傾ける。\n上へ押すと機首下げ、下へ引くと機首上げ。\n右の＋／−を押して出力調整。Ⅱで一時停止。\n計器を読みやすい横向きがおすすめです。',
  note: '姿勢を中央に、高度と速度を穏やかに。\n燃料は飛行3分で尽きます。一時停止中は減りません。\nその後は滑空し、海面に触れると飛行は終わります。',
  propeller: 'プロペラ音',
  volume: 'プロペラ音量',
  headphones: 'ヘッドフォン推奨',
  webglError: '3D描画を開始できません。WebGLが使えるブラウザで開いてください。',
  audioError: '音を開始できませんでした。無音で飛行できます。',
  fuel: '燃料',
  altitude: '高度',
  bank: 'バンク角',
  level: '水平',
};

export type MessageKey = keyof typeof ja;

const en: Record<MessageKey, string> = {
  pageTitle: 'Night Flight',
  sky: 'Night sky',
  cockpit: 'Flight instruments',
  readings: 'Instrument readings',
  pauseMenu: 'Pause and controls',
  touchControls: 'Touch controls',
  stickDescription: 'Stick: left/right to bank, up to lower the nose, down to raise it',
  stick: 'STICK',
  power: 'Power',
  powerUp: 'Increase power',
  powerDown: 'Decrease power',
  bankHelp: 'Bank left / right',
  pitchHelp: 'Lower / raise the nose',
  powerHelp: 'Increase / decrease power',
  pause: 'Pause',
  readyTitle: 'Into the night.',
  readyIntro:
    'Even when the stars are hidden, the needles move.\nA small aircraft, flying through the night.',
  start: 'Begin flight',
  pausedTitle: 'The night is here.',
  pausedIntro: 'Your flight is paused.\nReturn to the same sky.',
  resume: 'Resume flight',
  endedTitle: 'After the flight.',
  endedIntro: 'The propeller has stopped.\nThe night goes on.',
  restart: 'Fly again',
  touchHelp:
    'Left stick: move sideways to bank.\nPush up to lower the nose; pull down to raise it.\nHold + / − on the right to adjust power. Ⅱ pauses.\nLandscape orientation makes the instruments easier to read.',
  note: 'Keep your attitude steady, your altitude and speed gentle.\nFuel lasts three minutes of flight. Pausing preserves it.\nThen you glide, until the sea ends your flight.',
  propeller: 'Propeller sound',
  volume: 'Propeller volume',
  headphones: 'Headphones recommended',
  webglError: 'Unable to start 3D rendering. Please use a browser that supports WebGL.',
  audioError: 'Unable to start audio. You can fly without sound.',
  fuel: 'Fuel',
  altitude: 'Altitude',
  bank: 'Bank angle',
  level: 'LEVEL',
};

export function isLocale(value: unknown): value is Locale {
  return value === 'ja' || value === 'en';
}

export function chooseLocale(saved: unknown, languages: readonly string[]): Locale {
  if (isLocale(saved)) return saved;
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

export function initialLocale(): Locale {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem('night-flight.locale');
  } catch {
    // Storage may be unavailable; browser preferences still work.
  }
  return chooseLocale(saved, navigator.languages);
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem('night-flight.locale', locale);
  } catch {
    // Changing language must work even when preferences cannot be persisted.
  }
}

export function translate(locale: Locale, key: MessageKey): string {
  return (locale === 'ja' ? ja : en)[key];
}

function isMessageKey(value: string): value is MessageKey {
  return Object.hasOwn(ja, value);
}

export function translateDocument(locale: Locale): void {
  document.documentElement.lang = locale;
  document.title = translate(locale, 'pageTitle');
  for (const [attribute, target] of [
    ['data-i18n', 'text'],
    ['data-i18n-label', 'aria-label'],
  ] as const) {
    for (const element of document.querySelectorAll(`[${attribute}]`)) {
      const key = element.getAttribute(attribute);
      if (!key || !isMessageKey(key)) throw new Error(`Unknown translation: ${key}`);
      const text = translate(locale, key);
      if (target === 'text') element.textContent = text;
      else element.setAttribute(target, text);
    }
  }
}
