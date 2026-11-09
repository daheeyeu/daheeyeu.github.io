/* =========================================================
   ASMR 사운드 엔진 (Web Audio)
   - 동작마다 다른 질감: 사각사각 귀이개, 솜털, 거품, 물, 브러시, 톡톡 …
   - 스테레오(바이노럴 느낌) 패닝 + 작은 방 잔향
   - sounds/ 폴더에 실제 녹음 파일을 넣으면 그 파일을 우선 재생 (sounds/README.md)
   ========================================================= */

const rand = (a, b) => a + Math.random() * (b - a);

function poisson(lambda) {
  // 작은 λ 용 간단 포아송
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * (Math.random() * 2 - 1)));
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.textures = new Map();
    this.fileCache = new Map();
    this.synthOn = true; // 실제 녹음 파일이 재생 중이면 false
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(comp);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(1.6, 3.2);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.22;
    this.reverb.connect(this.reverbOut).connect(this.master);

    this.asmr = ctx.createGain();
    this.asmr.gain.value = 0.9;
    this.asmr.connect(this.master);
    this.asmrSend = ctx.createGain();
    this.asmrSend.gain.value = 0.18;
    this.asmr.connect(this.asmrSend).connect(this.reverb);

    this.bgm = ctx.createGain();
    this.bgm.gain.value = 0.45;
    this.bgm.connect(this.master);
    this.bgmSend = ctx.createGain();
    this.bgmSend.gain.value = 0.5;
    this.bgm.connect(this.bgmSend).connect(this.reverb);

    this.white = this._noise("white", 4);
    this.pink = this._noise("pink", 4);
    this.brown = this._noise("brown", 4);
    this.clicks = Array.from({ length: 24 }, (_, i) => this._click(0.0015 + (i % 8) * 0.0012));
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  get now() {
    return this.ctx.currentTime;
  }

  setAsmrVolume(v) {
    this.asmr.gain.setTargetAtTime(v, this.now, 0.1);
  }
  setBgmVolume(v) {
    this.bgm.gain.setTargetAtTime(v, this.now, 0.1);
  }
  fadeMaster(to, seconds) {
    const g = this.master.gain;
    g.cancelScheduledValues(this.now);
    g.setValueAtTime(g.value, this.now);
    g.linearRampToValueAtTime(to, this.now + seconds);
  }

  /* ---------- 버퍼 생성 ---------- */
  _noise(kind, seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") d[i] = w * 0.5;
        else if (kind === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.2;
        }
      }
    }
    return buf;
  }

  _click(dur) {
    const ctx = this.ctx;
    const len = Math.max(8, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 2.5);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    return buf;
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _pan(p, dest) {
    const sp = this.ctx.createStereoPanner();
    sp.pan.value = Math.max(-1, Math.min(1, p));
    sp.connect(dest);
    return sp;
  }

  /* ---------- 지속 질감 (텍스처) ---------- */
  // layers: [{buf, type, freq, Q, gain}]
  _makeTexture(layers, dest) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const pan = ctx.createStereoPanner();
    out.connect(pan).connect(dest);
    const parts = layers.map((L) => {
      const src = ctx.createBufferSource();
      src.buffer = this[L.buf || "white"];
      src.loop = true;
      src.playbackRate.value = L.rate || 1;
      const f = ctx.createBiquadFilter();
      f.type = L.type || "bandpass";
      f.frequency.value = L.freq || 1000;
      f.Q.value = L.Q ?? 0.7;
      let node = f;
      if (L.type2) {
        const f2 = ctx.createBiquadFilter();
        f2.type = L.type2;
        f2.frequency.value = L.freq2;
        f.connect(f2);
        node = f2;
      }
      const g = ctx.createGain();
      g.gain.value = L.gain ?? 0.5;
      src.connect(f);
      node.connect(g).connect(out);
      src.start(0, Math.random() * 3);
      return { src, f, g, base: L.freq || 1000, baseGain: L.gain ?? 0.5 };
    });
    return {
      out,
      pan,
      parts,
      set: (level, p = 0, freqMul = 1) => {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(this.synthOn ? Math.max(0, level) : 0, t, 0.035);
        pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), t, 0.05);
        if (freqMul !== 1 || parts._fm !== freqMul) {
          parts.forEach((x) => x.f.frequency.setTargetAtTime(x.base * freqMul, t, 0.05));
          parts._fm = freqMul;
        }
      },
      stop: () => {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.15);
        parts.forEach((x) => x.src.stop(t + 1));
        setTimeout(() => out.disconnect(), 1300);
      },
    };
  }

  static TEXTURES = {
    // 피부를 손끝으로 문지르는 소리 (가까운 마이크)
    rub: [
      { buf: "brown", type: "lowpass", freq: 520, Q: 0.6, gain: 0.9 },
      { buf: "pink", type: "bandpass", freq: 1500, Q: 1.1, gain: 0.35 },
    ],
    // 오일이 미끄러지는 매끈한 소리
    oil: [
      { buf: "pink", type: "bandpass", freq: 900, Q: 1.4, gain: 0.7 },
      { buf: "white", type: "bandpass", freq: 3200, Q: 2.5, gain: 0.12 },
    ],
    // 거품이 사르르 꺼지는 쉬익 소리
    fizz: [
      { buf: "white", type: "highpass", freq: 5200, Q: 0.5, gain: 0.16 },
      { buf: "pink", type: "bandpass", freq: 2600, Q: 0.9, gain: 0.18 },
    ],
    // 쫀쫀 거품을 굴리는 소리
    lather: [
      { buf: "pink", type: "bandpass", freq: 1100, Q: 0.9, gain: 0.6 },
      { buf: "brown", type: "lowpass", freq: 600, gain: 0.45 },
      { buf: "white", type: "highpass", freq: 6000, gain: 0.07 },
    ],
    // 샤워기 물소리
    water: [
      { buf: "white", type: "bandpass", freq: 3000, Q: 0.45, gain: 0.55 },
      { buf: "pink", type: "lowpass", freq: 1000, gain: 0.5 },
      { buf: "brown", type: "lowpass", freq: 260, gain: 0.35 },
    ],
    // 솜털 봉이 귀 안에서 사르륵
    fluff: [
      { buf: "pink", type: "bandpass", freq: 2100, Q: 0.8, gain: 0.55 },
      { buf: "white", type: "highpass", freq: 7000, gain: 0.08 },
    ],
    // 괄사 스톤이 오일 위로 미끄러지는 소리
    glide: [
      { buf: "pink", type: "bandpass", freq: 760, Q: 3.2, gain: 0.8 },
      { buf: "brown", type: "lowpass", freq: 300, gain: 0.35 },
    ],
    // 수건으로 비비는 거친 천 소리
    towel: [
      { buf: "white", type: "bandpass", freq: 1700, Q: 0.6, gain: 0.45 },
      { buf: "brown", type: "lowpass", freq: 400, gain: 0.5 },
    ],
    // 팩 브러시 모
    bristle: [
      { buf: "white", type: "highpass", freq: 3600, Q: 0.6, gain: 0.3 },
      { buf: "pink", type: "bandpass", freq: 1300, Q: 1.5, gain: 0.35 },
    ],
  };

  texture(name) {
    if (!this.textures.has(name)) {
      this.textures.set(name, this._makeTexture(SoundEngine.TEXTURES[name], this.asmr));
    }
    return this.textures.get(name);
  }

  stopTextures() {
    this.textures.forEach((t) => t.stop());
    this.textures.clear();
  }

  /* ---------- 미세 크래클 (거품·귀지·머리카락 결) ---------- */
  // 한 프레임(dt초) 동안 rate(초당 개수)만큼 아주 짧은 '틱' 소리를 뿌린다
  crackle(dt, { rate = 100, pan = 0, spread = 0.2, fmin = 2000, fmax = 8000, gain = 0.1, Q = 1.5 } = {}) {
    if (!this.synthOn) return;
    const n = poisson(rate * dt);
    if (!n) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.01;
    for (let i = 0; i < Math.min(n, 60); i++) {
      const src = ctx.createBufferSource();
      src.buffer = this.clicks[(Math.random() * this.clicks.length) | 0];
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = rand(fmin, fmax);
      f.Q.value = Q;
      const g = ctx.createGain();
      g.gain.value = gain * rand(0.25, 1);
      src.connect(f).connect(g).connect(this._pan(pan + rand(-spread, spread), this.asmr));
      src.start(t0 + Math.random() * dt);
    }
  }

  _burst({ buf = "white", t = 0, dur = 0.1, type = "bandpass", freq = 2000, freqEnd, Q = 1, gain = 0.3, attack = 0.005, pan = 0, dest }) {
    if (!this.synthOn && !dest) return;
    const ctx = this.ctx;
    const st = ctx.currentTime + 0.01 + t;
    const src = ctx.createBufferSource();
    src.buffer = this[buf];
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, st);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, st + dur);
    f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(gain, st + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
    src.connect(f).connect(g).connect(this._pan(pan, dest || this.asmr));
    src.start(st, Math.random() * 3);
    src.stop(st + dur + 0.05);
  }

  _tone({ t = 0, freq = 800, freqEnd, dur = 0.05, gain = 0.1, pan = 0, type = "sine", dest }) {
    if (!this.synthOn && !dest) return;
    const ctx = this.ctx;
    const st = ctx.currentTime + 0.01 + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, st);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, st + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(gain, st + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
    o.connect(g).connect(this._pan(pan, dest || this.asmr));
    o.start(st);
    o.stop(st + dur + 0.03);
  }

  /* ---------- 단발 효과음 ---------- */
  // 귀이개 '사각' — 귓속 긁힘 + 뼈 울림
  scratch(pan = 0.9, power = 1) {
    const len = rand(0.07, 0.15);
    this._burst({ buf: "white", dur: len, freq: rand(2800, 4200), freqEnd: rand(1800, 2600), Q: 1.8, gain: 0.32 * power, attack: 0.012, pan });
    this._burst({ buf: "brown", dur: len, type: "lowpass", freq: 260, gain: 0.5 * power, attack: 0.01, pan: pan * 0.8 });
    const n = (8 + Math.random() * 14) | 0;
    for (let i = 0; i < n; i++) {
      this._burst({ buf: "white", t: (i / n) * len, dur: rand(0.003, 0.008), freq: rand(2500, 7500), Q: 2, gain: rand(0.08, 0.3) * power, attack: 0.001, pan: pan + rand(-0.08, 0.08) });
    }
    if (Math.random() < 0.25) this._tone({ t: len * 0.5, freq: rand(140, 190), dur: 0.05, gain: 0.08 * power, pan });
  }

  // 손끝 톡톡 (피부 두드림)
  pat(pan = 0, power = 1) {
    this._burst({ buf: "brown", dur: 0.05, type: "lowpass", freq: 420, gain: 0.85 * power, attack: 0.002, pan });
    this._burst({ buf: "white", dur: 0.018, freq: 1600, Q: 1.2, gain: 0.18 * power, attack: 0.001, pan });
  }

  // 꾹 누르기 (수건/두피 지압)
  press(pan = 0, power = 1) {
    this._burst({ buf: "brown", dur: 0.22, type: "lowpass", freq: 300, gain: 0.6 * power, attack: 0.05, pan });
    this._burst({ buf: "pink", dur: 0.18, freq: 900, Q: 1, gain: 0.12 * power, attack: 0.04, pan });
  }

  // 거품 톡 터짐
  pop(pan = 0, power = 1) {
    this._tone({ freq: rand(1800, 4200), freqEnd: rand(2500, 6000), dur: rand(0.006, 0.015), gain: 0.05 * power, pan });
    this._burst({ buf: "white", dur: 0.006, freq: rand(3000, 8000), Q: 2, gain: 0.12 * power, attack: 0.001, pan });
  }

  // 물방울 똑
  drip(pan = 0, power = 1) {
    const f = rand(900, 1700);
    this._tone({ freq: f, freqEnd: f * 0.45, dur: 0.035, gain: 0.09 * power, pan });
    this._tone({ t: 0.03, freq: f * 1.6, freqEnd: f * 2.2, dur: 0.02, gain: 0.03 * power, pan });
  }

  // 쫀쫀 거품 '찹'
  squish(pan = 0, power = 1) {
    this._burst({ buf: "pink", dur: 0.14, freq: 450, freqEnd: 1500, Q: 3, gain: 0.45 * power, attack: 0.02, pan });
    for (let i = 0; i < 8; i++) this.pop(pan + rand(-0.15, 0.15), 0.5 * power);
  }

  // 크림 톡 (끈적하게 떨어지는 소리)
  cream(pan = 0, power = 1) {
    this._burst({ buf: "brown", dur: 0.06, type: "lowpass", freq: 700, gain: 0.6 * power, attack: 0.003, pan });
    this._burst({ buf: "white", t: 0.045, dur: 0.012, freq: 2600, Q: 2, gain: 0.2 * power, attack: 0.001, pan });
    this._burst({ buf: "pink", t: 0.02, dur: 0.07, freq: 1200, freqEnd: 600, Q: 4, gain: 0.12 * power, attack: 0.005, pan });
  }

  // 실리콘 두피 브러시 한 번 긁기
  brushStroke(pan = 0, power = 1) {
    const len = rand(0.12, 0.2);
    this._burst({ buf: "white", dur: len, freq: rand(3200, 4600), Q: 1.1, gain: 0.25 * power, attack: 0.03, pan });
    this._burst({ buf: "pink", dur: len, freq: 900, Q: 1.2, gain: 0.25 * power, attack: 0.03, pan });
    for (let i = 0; i < 18; i++) this._burst({ buf: "white", t: Math.random() * len, dur: 0.004, freq: rand(3000, 9000), Q: 2, gain: rand(0.05, 0.16) * power, attack: 0.001, pan: pan + rand(-0.2, 0.2) });
  }

  /* ---------- 실제 녹음 파일 (선택) ---------- */
  async tryFile(url) {
    if (this.fileCache.has(url)) return this.fileCache.get(url);
    if (!this.manifest) {
      try {
        const r = await fetch("sounds/manifest.json");
        this.manifest = r.ok ? await r.json() : [];
      } catch {
        this.manifest = [];
      }
    }
    let buf = null;
    if (!this.manifest.includes(url.replace(/^sounds\//, ""))) return null;
    try {
      const res = await fetch(url);
      if (res.ok) buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch {}
    this.fileCache.set(url, buf);
    return buf;
  }

  playLoop(buf, dest, gain = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(gain, ctx.currentTime, 0.5);
    src.connect(g).connect(dest);
    src.start();
    return {
      stop() {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        src.stop(ctx.currentTime + 2);
      },
    };
  }
}

/* =========================================================
   배경음 (빗소리 · 자연 · 파도 · 모닥불 · 클래식 피아노 · 브라운노이즈)
   ========================================================= */
export class Ambience {
  constructor(engine) {
    this.e = engine;
    this.kind = null;
    this.nodes = [];
    this.timer = null;
    this.fileLoop = null;
  }

  _layer(buf, type, freq, gain, Q = 0.7, pan = 0) {
    const ctx = this.e.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.e[buf];
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(gain, ctx.currentTime, 1.2);
    src.connect(f).connect(g).connect(this.e._pan(pan, this.e.bgm));
    src.start(0, Math.random() * 3);
    this.nodes.push({ src, g });
    return { src, f, g };
  }

  stop() {
    const t = this.e.ctx?.currentTime || 0;
    this.nodes.forEach(({ src, g }) => {
      g.gain.setTargetAtTime(0, t, 0.5);
      src.stop(t + 3);
    });
    this.nodes = [];
    clearInterval(this.timer);
    this.timer = null;
    this.fileLoop?.stop();
    this.fileLoop = null;
    this.kind = null;
  }

  async start(kind) {
    this.stop();
    if (!kind || kind === "off") return;
    this.kind = kind;
    const e = this.e;
    const file = await e.tryFile(`sounds/bgm-${kind}.mp3`);
    if (this.kind !== kind) return;
    if (file) {
      this.fileLoop = e.playLoop(file, e.bgm, 0.9);
      return;
    }
    const ctx = e.ctx;
    const B = (opts) => e._burst({ ...opts, dest: e.bgm });
    const T = (opts) => e._tone({ ...opts, dest: e.bgm });

    if (kind === "rain") {
      this._layer("pink", "lowpass", 5500, 0.55);
      this._layer("white", "highpass", 2500, 0.06);
      this._layer("brown", "lowpass", 160, 0.4);
      this.timer = setInterval(() => {
        // 빗방울: 잘게 부서지는 소리 + 가끔 처마 물방울
        for (let i = 0; i < 14; i++)
          B({ buf: "white", t: Math.random() * 0.1, dur: rand(0.004, 0.012), freq: rand(1500, 7000), Q: 1.5, gain: rand(0.02, 0.09), attack: 0.001, pan: rand(-0.9, 0.9) });
        if (Math.random() < 0.06) {
          const f = rand(500, 1000);
          T({ freq: f, freqEnd: f * 0.5, dur: 0.04, gain: 0.05, pan: rand(-0.6, 0.6) });
        }
      }, 100);
    } else if (kind === "nature") {
      const s1 = this._layer("white", "bandpass", 1100, 0.18, 0.5, -0.3);
      const s2 = this._layer("pink", "lowpass", 650, 0.35, 0.7, 0.3);
      this._layer("brown", "lowpass", 200, 0.2);
      let birdWait = 2;
      this.timer = setInterval(() => {
        const t = ctx.currentTime;
        s1.g.gain.setTargetAtTime(rand(0.1, 0.24), t, 0.15);
        s2.g.gain.setTargetAtTime(rand(0.25, 0.42), t, 0.2);
        if (Math.random() < 0.35) {
          const f = rand(300, 800);
          T({ freq: f, freqEnd: f * rand(1.4, 2), dur: rand(0.03, 0.07), gain: 0.03, pan: rand(-0.7, 0.7) });
        }
        birdWait -= 0.1;
        if (birdWait <= 0) {
          birdWait = rand(3, 9);
          const n = (rand(3, 8)) | 0;
          const base = rand(2600, 4200);
          const pan = rand(-0.9, 0.9);
          const style = Math.random();
          for (let i = 0; i < n; i++) {
            const tt = i * rand(0.09, 0.16);
            const f = base * rand(0.9, 1.15);
            T({ t: tt, freq: f, freqEnd: style < 0.5 ? f * 1.35 : f * 0.7, dur: rand(0.05, 0.1), gain: 0.025, pan });
          }
        }
      }, 100);
    } else if (kind === "waves") {
      const body = this._layer("brown", "lowpass", 400, 0.2);
      const hiss = this._layer("white", "highpass", 1800, 0.02);
      let phase = 0;
      this.timer = setInterval(() => {
        phase += 0.1;
        const t = ctx.currentTime;
        const cycle = (phase % 11) / 11; // 11초 주기
        const swell = cycle < 0.45 ? cycle / 0.45 : Math.max(0, 1 - (cycle - 0.45) / 0.55);
        body.g.gain.setTargetAtTime(0.15 + swell * 0.75, t, 0.25);
        body.f.frequency.setTargetAtTime(250 + swell * 900, t, 0.25);
        hiss.g.gain.setTargetAtTime(0.01 + Math.pow(swell, 3) * 0.12, t, 0.3);
      }, 100);
    } else if (kind === "fire") {
      this._layer("brown", "lowpass", 280, 0.6);
      this._layer("pink", "bandpass", 900, 0.05, 0.6);
      this.timer = setInterval(() => {
        if (Math.random() < 0.55) {
          const n = Math.random() < 0.15 ? (rand(3, 7) | 0) : 1;
          for (let i = 0; i < n; i++)
            B({ buf: "white", t: i * rand(0.01, 0.05), dur: rand(0.004, 0.02), freq: rand(800, 4500), Q: 1.2, gain: rand(0.05, 0.35), attack: 0.001, pan: rand(-0.4, 0.4) });
        }
      }, 100);
    } else if (kind === "brown") {
      this._layer("brown", "lowpass", 900, 0.7);
    } else if (kind === "piano") {
      this._piano();
    }
  }

  /* 파헬벨 캐논(퍼블릭 도메인) 코드 진행을 아주 느리고 잔잔한 피아노 아르페지오로 */
  _piano() {
    const e = this.e;
    const ctx = e.ctx;
    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const bass = [50, 45, 47, 42, 43, 38, 43, 45];
    const minor = [false, false, true, true, false, false, false, false];
    const melody = [78, 76, 74, 73, 71, 69, 71, 73];
    const step = 0.62; // 8분음표 길이(초)
    let next = ctx.currentTime + 0.3;
    let n = 0;

    const note = (m, t, vel) => {
      const f = midi(m);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800 + vel * 1500;
      const out = ctx.createGain();
      out.gain.value = vel * 0.14;
      lp.connect(out).connect(e.bgm);
      [1, 2, 3, 4.01].forEach((h, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? "triangle" : "sine";
        o.frequency.value = f * h;
        o.detune.value = rand(-3, 3);
        const g = ctx.createGain();
        const amp = [1, 0.4, 0.15, 0.06][i];
        const decay = [3.4, 1.8, 1.0, 0.6][i];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay * (m < 55 ? 1.6 : 1));
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + 6);
      });
    };

    this.timer = setInterval(() => {
      while (next < ctx.currentTime + 0.5) {
        const bar = Math.floor(n / 8) % 8;
        const i = n % 8;
        const root = bass[bar];
        const tones = minor[bar] ? [0, 7, 12, 15, 19, 24] : [0, 7, 12, 16, 19, 24];
        const order = [0, 1, 2, 3, 4, 3, 2, 1];
        const hum = rand(-0.012, 0.012);
        if (i === 0) {
          note(root - 12, next, 0.55);
          note(melody[bar], next + 0.02, 0.5);
        }
        if (i === 4 && Math.random() < 0.5) note(melody[(bar + 1) % 8] - 0, next, 0.28);
        note(root + tones[order[i]], next + hum, 0.32 + (i === 0 ? 0.1 : 0));
        n++;
        next += step * (i === 7 ? 1.15 : 1); // 마디 끝에서 살짝 숨 고르기
      }
    }, 100);
  }
}
