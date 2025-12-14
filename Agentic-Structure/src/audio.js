const DEFAULT_VOLUME = 0.22;

function now(context) {
  return context.currentTime;
}

function createGain(context, value) {
  const gain = context.createGain();
  gain.gain.value = value;
  gain.connect(context.destination);
  return gain;
}

function playBeep(context, { frequency, durationSec, type = "sine", volume = 0.2, detune = 0 }) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.detune.value = detune;

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now(context));
  gain.gain.exponentialRampToValueAtTime(volume, now(context) + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now(context) + durationSec);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(now(context) + durationSec + 0.02);
}

export class Sfx {
  constructor() {
    this.context = null;
    this.muted = false;
    this.volume = DEFAULT_VOLUME;
  }

  isReady() {
    return this.context != null;
  }

  async unlock() {
    if (this.context) return;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    this.context = new AudioContextCtor();
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        // ignore: some browsers require a user gesture; caller will retry.
      }
    }
  }

  setMuted(muted) {
    this.muted = muted;
  }

  play(name, detail = {}) {
    if (!this.context || this.muted) return;
    if (this.context.state === "suspended") return;

    const base = this.volume;
    if (name === "move") {
      playBeep(this.context, { frequency: 420, durationSec: 0.04, type: "square", volume: base * 0.35 });
      return;
    }
    if (name === "rotate") {
      playBeep(this.context, { frequency: 650, durationSec: 0.06, type: "triangle", volume: base * 0.4 });
      return;
    }
    if (name === "hold") {
      playBeep(this.context, { frequency: 330, durationSec: 0.08, type: "sine", volume: base * 0.5 });
      return;
    }
    if (name === "softDrop") {
      playBeep(this.context, { frequency: 260, durationSec: 0.03, type: "sine", volume: base * 0.18 });
      return;
    }
    if (name === "hardDrop") {
      playBeep(this.context, { frequency: 180, durationSec: 0.08, type: "sawtooth", volume: base * 0.55 });
      playBeep(this.context, { frequency: 120, durationSec: 0.1, type: "sine", volume: base * 0.35 });
      return;
    }
    if (name === "lock") {
      playBeep(this.context, { frequency: 210, durationSec: 0.05, type: "square", volume: base * 0.25 });
      return;
    }
    if (name === "clear") {
      const lines = Math.max(1, Math.min(4, detail.lines ?? 1));
      const chord = lines === 4 ? [523, 659, 784] : lines === 3 ? [523, 659] : [523];
      chord.forEach((freq, index) => {
        playBeep(this.context, {
          frequency: freq,
          durationSec: 0.12,
          type: "triangle",
          volume: base * 0.5,
          detune: index * 8,
        });
      });
      return;
    }
    if (name === "gameOver") {
      playBeep(this.context, { frequency: 110, durationSec: 0.25, type: "sawtooth", volume: base * 0.6 });
      playBeep(this.context, { frequency: 85, durationSec: 0.35, type: "square", volume: base * 0.35 });
      return;
    }
    if (name === "pause") {
      playBeep(this.context, { frequency: 300, durationSec: 0.06, type: "sine", volume: base * 0.35 });
      return;
    }
    if (name === "resume") {
      playBeep(this.context, { frequency: 520, durationSec: 0.06, type: "sine", volume: base * 0.35 });
      return;
    }
  }
}

