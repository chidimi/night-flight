import type { FlightInput } from './flight.ts';

/** Pointer capture keeps a held control consistent when a finger leaves its bounds. */
export function createTouchControls(container: HTMLElement, stick: HTMLElement) {
  const input: Required<FlightInput> = { roll: 0, pitch: 0, power: 0 };
  container.addEventListener('contextmenu', (event) => event.preventDefault());
  let stickPointer: number | undefined;
  const powerPointers = new Map<number, number>();

  function updateStick(event: PointerEvent): void {
    const bounds = stick.getBoundingClientRect();
    const radius = bounds.width / 2;
    const x = (event.clientX - bounds.left - radius) / radius;
    const y = (event.clientY - bounds.top - bounds.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    input.roll = x / length;
    input.pitch = y / length;
    stick.style.setProperty('--stick-x', `${input.roll * 34}px`);
    stick.style.setProperty('--stick-y', `${input.pitch * 34}px`);
  }

  function resetStick(): void {
    stickPointer = undefined;
    input.roll = 0;
    input.pitch = 0;
    stick.style.setProperty('--stick-x', '0px');
    stick.style.setProperty('--stick-y', '0px');
  }

  stick.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || stickPointer !== undefined) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    updateStick(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === stickPointer) updateStick(event);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    stick.addEventListener(name, (event) => {
      if (event.pointerId === stickPointer) resetStick();
    });
  }

  function updatePower(): void {
    input.power = Math.max(
      -1,
      Math.min(
        1,
        [...powerPointers.values()].reduce((a, b) => a + b, 0),
      ),
    );
    for (const button of container.querySelectorAll('button[data-power]')) {
      button.classList.toggle(
        'held',
        [...powerPointers.values()].includes(Number(button.getAttribute('data-power'))),
      );
    }
  }

  for (const button of container.querySelectorAll('button[data-power]')) {
    if (!(button instanceof HTMLButtonElement)) continue;
    const direction = Number(button.dataset.power);
    if (direction !== 1 && direction !== -1) throw new Error('Invalid power direction');
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      powerPointers.set(event.pointerId, direction);
      updatePower();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      button.addEventListener(name, (event) => {
        powerPointers.delete(event.pointerId);
        updatePower();
      });
    }
  }

  function reset(): void {
    resetStick();
    powerPointers.clear();
    updatePower();
  }

  return { input, reset };
}
