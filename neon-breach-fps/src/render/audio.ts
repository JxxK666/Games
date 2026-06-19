import type { GameEvent } from "../game/types";

export class AudioDirector {
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: OscillatorNode;

  async unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.34;
      this.master.connect(this.context.destination);
      this.startAmbience();
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  handleEvents(events: GameEvent[]) {
    if (!this.context || !this.master) return;
    for (const event of events) {
      if (event.type === "shot") this.playGunshot();
      if (event.type === "empty") this.playEmpty();
      if (event.type === "reload") this.playReload();
      if (event.type === "reloadComplete") this.playReloadComplete();
      if (event.type === "enemyKilled") this.playEnemyDown();
      if (event.type === "playerHit") this.playPlayerHit();
      if (event.type === "enemyHit") this.playHitConfirm(event.killed);
    }
  }

  private startAmbience() {
    if (!this.context || !this.master || this.ambience) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.value = 48;
    filter.type = "lowpass";
    filter.frequency.value = 320;
    gain.gain.value = 0.026;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.ambience = osc;
  }

  private playGunshot() {
    this.noiseBurst(0.07, 900, 0.18);
    this.tone(95, 0.055, "square", 0.16, 0.01);
  }

  private playEmpty() {
    this.tone(380, 0.045, "square", 0.055);
    this.tone(240, 0.04, "triangle", 0.04, 0.03);
  }

  private playReload() {
    this.tone(180, 0.08, "triangle", 0.09);
    this.tone(260, 0.09, "triangle", 0.08, 0.26);
  }

  private playReloadComplete() {
    this.tone(560, 0.07, "sine", 0.07);
  }

  private playEnemyDown() {
    this.noiseBurst(0.12, 300, 0.08);
    this.tone(74, 0.22, "sawtooth", 0.08);
  }

  private playPlayerHit() {
    this.noiseBurst(0.1, 520, 0.16);
    this.tone(130, 0.16, "sawtooth", 0.12);
  }

  private playHitConfirm(killed: boolean) {
    if (killed) {
      this.clickBurst(0.014, 3200, 0.045);
      this.hitBell(1180, 0.24, 0.11);
      this.hitBell(1770, 0.17, 0.05, 0.006);
      return;
    }

    this.clickBurst(0.026, 210, 0.075);
    this.tone(145, 0.065, "triangle", 0.09);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.58), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  private noiseBurst(duration: number, cutoff: number, volume: number) {
    if (!this.context || !this.master) return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const falloff = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * falloff;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  private hitBell(frequency: number, duration: number, volume: number, delay = 0) {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const shimmer = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = "sine";
    shimmer.type = "triangle";
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.985, start + duration);
    shimmer.frequency.setValueAtTime(frequency * 2.01, start);
    filter.type = "bandpass";
    filter.frequency.value = frequency * 1.22;
    filter.Q.value = 0.72;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter);
    shimmer.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    shimmer.start(start);
    osc.stop(start + duration + 0.03);
    shimmer.stop(start + duration + 0.03);
  }

  private clickBurst(duration: number, frequency: number, volume: number) {
    if (!this.context || !this.master) return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const falloff = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * falloff * falloff;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 2.8;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
