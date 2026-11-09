/* 효과음: 파일 없이 Web Audio 로 ASMR 느낌 소리를 만든다 */
const ASMR = (() => {
  let ctx = null;
  let noiseBuf = null;
  let enabled = true;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 필터 걸린 노이즈 한 번 (t: 시작, dur: 길이)
  function burst(t, dur, { type = "bandpass", freq = 3000, q = 1, gain = 0.25, attack = 0.01 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return f;
  }

  function blip(t, freq, dur, gain = 0.08, endFreq) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(endFreq || freq * 1.8, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const RECIPES = {
    shave(t0, len) {
      for (let t = 0; t < len; t += 0.42) {
        burst(t0 + t, 0.28, { type: "highpass", freq: 5200, gain: 0.18, attack: 0.04 });
        burst(t0 + t + 0.05, 0.12, { freq: 7500, q: 4, gain: 0.08 });
      }
    },
    wax(t0, len) {
      for (let t = 0; t < len; t += 1.2) {
        const f = burst(t0 + t, 0.7, { type: "lowpass", freq: 600, gain: 0.15, attack: 0.2 });
        f.frequency.linearRampToValueAtTime(1400, t0 + t + 0.7);
        burst(t0 + t + 0.85, 0.18, { type: "highpass", freq: 2500, gain: 0.35, attack: 0.005 });
      }
    },
    ear(t0, len) {
      for (let i = 0; i < len * 38; i++) {
        const t = t0 + Math.random() * len;
        burst(t, 0.02 + Math.random() * 0.03, { freq: 2500 + Math.random() * 4000, q: 2, gain: 0.12 + Math.random() * 0.15, attack: 0.002 });
      }
    },
    massage(t0, len) {
      for (let t = 0; t < len; t += 0.8) {
        burst(t0 + t, 0.7, { type: "lowpass", freq: 450, gain: 0.3, attack: 0.3 });
      }
    },
    pack(t0, len) {
      for (let t = 0; t < len; t += 0.35) {
        burst(t0 + t, 0.2, { freq: 900 + Math.random() * 500, q: 3, gain: 0.22, attack: 0.02 });
        blip(t0 + t + 0.05, 180 + Math.random() * 80, 0.08, 0.05, 120);
      }
    },
    foam(t0, len) {
      for (let i = 0; i < len * 22; i++) {
        const t = t0 + Math.random() * len;
        blip(t, 500 + Math.random() * 1200, 0.04 + Math.random() * 0.04, 0.05);
      }
      burst(t0, len, { type: "highpass", freq: 6000, gain: 0.04, attack: 0.3 });
    },
    water(t0, len) {
      burst(t0, len, { type: "lowpass", freq: 1800, gain: 0.22, attack: 0.25 });
      burst(t0, len, { type: "bandpass", freq: 4000, q: 0.6, gain: 0.08, attack: 0.25 });
      for (let i = 0; i < len * 10; i++) blip(t0 + Math.random() * len, 700 + Math.random() * 900, 0.05, 0.04);
    },
    crunch(t0, len) {
      for (let t = 0.1; t < len; t += 0.55 + Math.random() * 0.3) {
        for (let j = 0; j < 6; j++) {
          burst(t0 + t + j * 0.018, 0.05, { type: "highpass", freq: 1500 + Math.random() * 2500, gain: 0.3, attack: 0.002 });
        }
      }
    },
  };

  return {
    play(kind, seconds = 3) {
      if (!enabled) return;
      const c = ac();
      if (!c || !RECIPES[kind]) return;
      RECIPES[kind](c.currentTime + 0.02, seconds);
    },
    coin() {
      if (!enabled) return;
      const c = ac();
      if (!c) return;
      const t = c.currentTime;
      blip(t, 988, 0.08, 0.06, 990);
      blip(t + 0.08, 1319, 0.2, 0.06, 1320);
    },
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    get enabled() {
      return enabled;
    },
  };
})();
