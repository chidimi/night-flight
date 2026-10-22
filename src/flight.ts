/** Angles are radians, distances metres, speeds metres per second. */
export interface FlightState {
  x: number;
  z: number;
  altitude: number;
  speed: number;
  pitch: number;
  bank: number;
  heading: number;
  vertical: number;
  /** Pilot throttle setting, from 0 to 1. */
  throttle: number;
  rollRate: number;
  pitchRate: number;
  /** Active simulation time in seconds; paused time is excluded. */
  time: number;
  /** Remaining fuel fraction, from 0 to 1. */
  fuel: number;
  ended: boolean;
}
export interface FlightInput {
  roll?: number;
  pitch?: number;
  power?: number;
}
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const FUEL_DURATION = 180;
export const enginePower = (state: FlightState): number =>
  state.fuel > 0 ? state.throttle : 0;
export function createFlight(): FlightState {
  return {
    x: 0,
    z: 0,
    altitude: 1200,
    speed: 52,
    pitch: 0,
    bank: 0,
    heading: 0,
    vertical: 0,
    throttle: 0.65,
    rollRate: 0,
    pitchRate: 0,
    time: 0,
    fuel: 1,
    ended: false,
  };
}
export function step(state: FlightState, input: FlightInput, deltaSeconds: number): void {
  if (state.ended) return;
  // Fuel is tied to active flight time, independently of throttle.
  state.time += deltaSeconds;
  state.fuel = Math.max(0, 1 - state.time / FUEL_DURATION);
  if (state.fuel < 1e-10) state.fuel = 0;
  state.throttle = clamp(state.throttle + (input.power || 0) * deltaSeconds * 0.17, 0, 1);

  // Smooth control response before integrating pitch and bank.
  state.rollRate +=
    ((input.roll || 0) * 0.3 - state.rollRate) * Math.min(1, deltaSeconds * 3);
  state.pitchRate +=
    ((input.pitch || 0) * 0.12 - state.pitchRate) * Math.min(1, deltaSeconds * 3);
  state.bank = clamp(state.bank + state.rollRate * deltaSeconds, -1.15, 1.15);
  state.pitch = clamp(state.pitch + state.pitchRate * deltaSeconds, -0.5, 0.5);

  // A trimmed cruise balances thrust; pitch and bank trade speed and altitude.
  const power = enginePower(state);
  const targetSpeed = 27 + power * 38.46 - Math.sin(state.pitch) * 32;
  state.speed += (targetSpeed - state.speed) * deltaSeconds * 0.16;
  const stallSinkRate = Math.max(0, 32 - state.speed) * 0.55;
  const targetVerticalSpeed =
    Math.sin(state.pitch) * state.speed +
    (power - 0.65) * 6 -
    (1 - Math.cos(state.bank)) * 7 -
    stallSinkRate;
  state.vertical += (targetVerticalSpeed - state.vertical) * deltaSeconds * 0.7;

  // Integrate the turn and position in world coordinates.
  state.heading =
    (state.heading +
      ((9.81 * Math.tan(state.bank)) / Math.max(25, state.speed)) * deltaSeconds +
      Math.PI * 2) %
    (Math.PI * 2);
  state.altitude += state.vertical * deltaSeconds;
  state.x += Math.sin(state.heading) * state.speed * deltaSeconds;
  state.z -= Math.cos(state.heading) * state.speed * deltaSeconds;
  if (state.altitude <= 0) {
    state.altitude = 0;
    state.ended = true;
  }
}
