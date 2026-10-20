import { enginePower, type FlightState } from './flight.ts';

interface Harmonic {
  oscillator: OscillatorNode;
  multiple: number;
}

/** A continuous propeller tone. All sound parameters follow the flight state. */
export class Propeller {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private harmonics: Harmonic[] = [];
  volume = 0.3;

  async init(): Promise<void> {
    if (!this.context) {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      this.context = context;
      this.master = master;

      const spectrum: [number, number][] = [
        [1, 0.42],
        [2, 0.22],
        [3, 0.1],
        [5, 0.035],
      ];
      for (const [multiple, level] of spectrum) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        gain.gain.value = level;
        oscillator.connect(gain).connect(master);
        oscillator.start();
        this.harmonics.push({ oscillator, multiple });
      }
    }
    await this.context.resume();
  }

  update(state: FlightState, active: boolean): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const power = enginePower(state);
    const frequency = power < 0.015 ? 0 : 26 + power * 22;
    for (const { oscillator, multiple } of this.harmonics) {
      oscillator.frequency.setTargetAtTime(Math.max(1, frequency * multiple), now, 0.25);
    }
    const audible = active && !state.ended && frequency > 0;
    const gain = audible ? this.volume * (0.12 + power * 0.14) : 0;
    this.master.gain.setTargetAtTime(gain, now, 0.15);
  }
}
