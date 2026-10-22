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
  /** Actual control-surface deflection, from -1 to 1; keys set a target. */
  aileron: number;
  elevator: number;
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
    aileron: 0,
    elevator: 0,
    rollRate: 0,
    pitchRate: 0,
    time: 0,
    fuel: 1,
    ended: false,
  };
}
// Control travel is measured in full deflections per second. Angular-rate
// response times are in seconds; releasing a key centres the surface, not the plane.
const CONTROL_TRAVEL = 3;
const CONTROL_RETURN = 4.5;
const ROLL_RESPONSE = 0.45;
const PITCH_RESPONSE = 0.6;

function moveSurface(current: number, target: number, seconds: number): number {
  const travel = (target === 0 ? CONTROL_RETURN : CONTROL_TRAVEL) * seconds;
  return current + clamp(target - current, -travel, travel);
}

function updateAttitude(state: FlightState, input: FlightInput, seconds: number): void {
  state.aileron = moveSurface(state.aileron, clamp(input.roll ?? 0, -1, 1), seconds);
  state.elevator = moveSurface(state.elevator, clamp(input.pitch ?? 0, -1, 1), seconds);
  // A bounded approximation of airspeed-dependent control effectiveness.
  // This changes only attitude response, not lift, drag, fuel or glide equations.
  const authority = clamp((state.speed / 52) ** 2, 0.35, 1.25);
  const targetRollRate = state.aileron * 0.3 * authority;
  const targetPitchRate = state.elevator * 0.12 * authority;
  state.rollRate +=
    (targetRollRate - state.rollRate) * (1 - Math.exp(-seconds / ROLL_RESPONSE));
  state.pitchRate +=
    (targetPitchRate - state.pitchRate) * (1 - Math.exp(-seconds / PITCH_RESPONSE));

  const bank = state.bank + state.rollRate * seconds;
  const pitch = state.pitch + state.pitchRate * seconds;
  state.bank = clamp(bank, -1.15, 1.15);
  state.pitch = clamp(pitch, -0.5, 0.5);
  // Do not keep accumulating rotation into the existing attitude limits.
  if (bank !== state.bank) state.rollRate = 0;
  if (pitch !== state.pitch) state.pitchRate = 0;
}

export function step(state: FlightState, input: FlightInput, deltaSeconds: number): void {
  if (state.ended) return;
  // Fuel is tied to active flight time, independently of throttle.
  state.time += deltaSeconds;
  state.fuel = Math.max(0, 1 - state.time / FUEL_DURATION);
  if (state.fuel < 1e-10) state.fuel = 0;
  state.throttle = clamp(state.throttle + (input.power || 0) * deltaSeconds * 0.17, 0, 1);

  updateAttitude(state, input, deltaSeconds);

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
