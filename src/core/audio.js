/**
 * WebAudio sound manager. No external audio files: five synthesised SFX plus a
 * very quiet exterior wind bed. The audio context is created on the first user
 * gesture, as browsers require.
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.4;
    this.wind = null;
    this.windGain = null;
    this.environment = { outside: false, storm: 0 };
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const compressor = this.ctx.createDynamicsCompressor();
    this.master.connect(compressor);
    compressor.connect(this.ctx.destination);
    this._buildWind();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setEnvironment({ outside, storm }) {
    this.environment = { outside, storm };
    if (!this.windGain || !this.ctx) return;
    const target = 0.012 + (outside ? 0.05 : 0) + storm * 0.06;
    this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8);
  }

  _buildWind() {
    if (!this.ctx) return;
    const seconds = 3;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.012;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    this.wind = source;
    this.windGain = gain;
  }

  _tone({ freq = 440, endFreq = null, duration = 0.12, type = 'sine', volume = 0.2, delay = 0, attack = 0.01 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  _noise({ duration = 0.3, volume = 0.1, filterFreq = 900, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
  }

  play(name) {
    this.unlock();
    if (!this.ctx) return;
    switch (name) {
      case 'click':
        this._tone({ freq: 620, endFreq: 780, duration: 0.06, type: 'square', volume: 0.035 });
        break;
      case 'repair':
        this._tone({ freq: 420, endFreq: 620, duration: 0.16, type: 'triangle', volume: 0.12 });
        this._tone({ freq: 620, endFreq: 880, duration: 0.18, type: 'triangle', volume: 0.1, delay: 0.12 });
        break;
      case 'report':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          this._tone({ freq, duration: 0.2, type: 'sine', volume: 0.12, delay: i * 0.085 });
        });
        break;
      case 'alarm':
        this._tone({ freq: 240, endFreq: 210, duration: 0.24, type: 'sawtooth', volume: 0.09 });
        this._tone({ freq: 240, endFreq: 210, duration: 0.24, type: 'sawtooth', volume: 0.09, delay: 0.32 });
        this._tone({ freq: 240, endFreq: 190, duration: 0.3, type: 'sawtooth', volume: 0.08, delay: 0.64 });
        break;
      case 'event':
        this._tone({ freq: 120, endFreq: 70, duration: 0.55, type: 'sine', volume: 0.18 });
        this._noise({ duration: 0.4, volume: 0.06, filterFreq: 500 });
        break;
      case 'scan':
        this._tone({ freq: 300, endFreq: 950, duration: 0.45, type: 'sine', volume: 0.08 });
        this._tone({ freq: 600, endFreq: 1400, duration: 0.3, type: 'triangle', volume: 0.04, delay: 0.08 });
        break;
      case 'error':
        this._tone({ freq: 170, endFreq: 110, duration: 0.18, type: 'square', volume: 0.06 });
        break;
      case 'step':
        this._noise({ duration: 0.06, volume: 0.015, filterFreq: 300 });
        break;
      default:
        break;
    }
  }
}
