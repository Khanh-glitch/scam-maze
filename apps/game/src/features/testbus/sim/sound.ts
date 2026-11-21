export class TransitAudio {
  private audio?: AudioContext;
  private mix?: GainNode;
  private street?: GainNode;
  private motor?: GainNode;
  private rain?: GainNode;
  private insects?: GainNode;
  private oscillator?: OscillatorNode;
  private noise?: AudioBuffer;
  private muted = true;
  private paused = false;

  enable(muted: boolean) {
    this.muted = muted;
    if (!muted && !this.audio && typeof AudioContext !== 'undefined') {
      const audio = new AudioContext();
      this.audio = audio;
      const length = audio.sampleRate * 3;
      const noise = audio.createBuffer(1, length, audio.sampleRate);
      const track = noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        last = last * 0.967 + (Math.random() * 2 - 1) * 0.071;
        track[i] = last;
      }
      this.noise = noise;
      const mix = audio.createGain(); mix.gain.value = 0; mix.connect(audio.destination); this.mix = mix;
      const wind = audio.createBufferSource(); wind.buffer = noise; wind.loop = true;
      const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 350;
      const street = audio.createGain(); street.gain.value = 0.19; this.street = street;
      wind.connect(filter); filter.connect(street); street.connect(mix); wind.start();
      const white=audio.createBuffer(1,length,audio.sampleRate);const samples=white.getChannelData(0);for(let i=0;i<length;i++)samples[i]=Math.random()*2-1;
      const bed=audio.createBufferSource();bed.buffer=white;bed.loop=true;
      const rain=audio.createBiquadFilter();rain.type='highpass';rain.frequency.value=2350;this.rain=audio.createGain();this.rain.gain.value=0;bed.connect(rain).connect(this.rain).connect(mix);
      const band=audio.createBiquadFilter();band.type='bandpass';band.frequency.value=4850;band.Q.value=8;this.insects=audio.createGain();this.insects.gain.value=0;bed.connect(band).connect(this.insects).connect(mix);bed.start();
      const oscillator = audio.createOscillator(); oscillator.type = 'triangle'; oscillator.frequency.value = 63;
      const motor = audio.createGain(); motor.gain.value = 0; oscillator.connect(motor); motor.connect(mix); oscillator.start();
      this.motor = motor; this.oscillator = oscillator;
    }
    if (!muted && this.audio?.state === 'suspended') void this.audio.resume().catch(() => {});
    this.fade();
  }

  pause(paused: boolean) { this.paused = paused; this.fade(); }

  private fade() {
    if (this.audio && this.mix) this.mix.gain.setTargetAtTime(this.paused || this.muted ? 0 : 0.55, this.audio.currentTime, 0.13);
  }

  update(speed: number, distance: number, aboard: boolean, rainy:boolean) {
    if (!this.audio || this.muted) return;
    const now = this.audio.currentTime;
    this.rain?.gain.setTargetAtTime(rainy?(aboard?.045:.13):0,now,.3);
    this.insects?.gain.setTargetAtTime(rainy?0:(.026+.016*Math.sin(now*80))*(aboard?.28:1),now,.025);
    this.street?.gain.setTargetAtTime(aboard ? 0.075 : 0.22, now, 0.36);
    this.motor?.gain.setTargetAtTime((0.006 + speed * 0.010) * (aboard ? 0.82 : Math.max(0, 1 - distance / 17)), now, 0.17);
    this.oscillator?.frequency.setTargetAtTime(57 + speed * 11.4, now, 0.19);
  }

  burst(kind: 'door' | 'footstep') {
    if (!this.audio || !this.mix || this.muted || !this.noise) return;
    const audio = this.audio, time = audio.currentTime;
    const source = audio.createBufferSource(); source.buffer = this.noise; source.playbackRate.value = kind === 'door' ? 1.55 : 0.88 + Math.random() * 0.38;
    const filter = audio.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = kind === 'door' ? 1320 : 195;
    const gain = audio.createGain(); gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(kind === 'door' ? 0.15 : 0.11, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (kind === 'door' ? 0.74 : 0.18));
    source.connect(filter); filter.connect(gain); gain.connect(this.mix);
    source.start(time, Math.random()); source.stop(time + (kind === 'door' ? 0.76 : 0.20));
  }

  chime(kind: 'fare' | 'arrival') {
    if (!this.audio || !this.mix || this.muted) return;
    const audio = this.audio;
    [kind === 'fare' ? 620 : 493, kind === 'fare' ? 830 : 660].forEach((frequency, i) => {
      const t = audio.currentTime + i * 0.15;
      const note = audio.createOscillator(); note.frequency.value = frequency;
      const gain = audio.createGain(); gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.028);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
      note.connect(gain); gain.connect(this.mix!); note.start(t); note.stop(t + 0.245);
    });
  }

  dispose() { if (this.audio) void this.audio.close().catch(() => {}); }
}