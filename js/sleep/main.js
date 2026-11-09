/* 수면 ASMR 극장 — 진행/컨트롤/타이머 */
import { BeautyScene } from "./scene.js";
import { SoundEngine, Ambience } from "./sound.js";
import { COURSES } from "./steps.js";

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem("sleep_" + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("sleep_" + k, JSON.stringify(v));
    } catch {}
  },
};

const BGMS = [
  ["off", "🔇 끄기"],
  ["rain", "🌧️ 빗소리"],
  ["nature", "🌿 숲·시냇물"],
  ["waves", "🌊 파도"],
  ["fire", "🔥 모닥불"],
  ["piano", "🎹 클래식 피아노"],
  ["brown", "🌫️ 브라운 노이즈"],
];
const TIMERS = [
  [0, "끄지 않기"],
  [10, "10분"],
  [30, "30분"],
  [60, "1시간"],
];
const LENGTHS = [
  [30, "짧게 30초"],
  [60, "보통 1분"],
  [90, "길게 1분 30초"],
];

const params = new URLSearchParams(location.search);
const cfg = {
  course: COURSES[params.get("course")] ? params.get("course") : store.get("course", "all"),
  bgm: store.get("bgm", "rain"),
  timer: store.get("timer", 30),
  len: store.get("len", 60),
  asmrVol: store.get("asmrVol", 0.9),
  bgmVol: store.get("bgmVol", 0.45),
};
const saveCfg = () => Object.entries(cfg).forEach(([k, v]) => store.set(k, v));

const S = new BeautyScene($("#stage"));
const snd = new SoundEngine();
const amb = new Ambience(snd);

const run = {
  started: false,
  paused: false,
  idx: 0,
  stepT: 0,
  st: {},
  step: null,
  endAt: 0,
  ending: false,
  ended: false,
  clock: 0,
};

/* ---------- 칩 UI ---------- */
function chips(el, items, current, onPick) {
  el.innerHTML = items.map(([v, label]) => `<button class="chip ${v === current ? "on" : ""}" data-v="${v}">${label}</button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    const raw = b.dataset.v;
    const v = isNaN(Number(raw)) ? raw : Number(raw);
    [...el.children].forEach((c) => c.classList.toggle("on", c === b));
    onPick(v);
  };
}

function renderCourseCards() {
  $("#course-cards").innerHTML = Object.entries(COURSES)
    .map(([k, c]) => `<button class="course ${k === cfg.course ? "on" : ""}" data-k="${k}"><b>${c.icon} ${c.name}</b><span>${c.desc}</span></button>`)
    .join("");
}
$("#course-cards").onclick = (e) => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  cfg.course = b.dataset.k;
  renderCourseCards();
};
renderCourseCards();
chips($("#s-bgm"), BGMS, cfg.bgm, (v) => (cfg.bgm = v));
chips($("#s-timer"), TIMERS, cfg.timer, (v) => (cfg.timer = v));
chips($("#s-len"), LENGTHS, cfg.len, (v) => (cfg.len = v));

function setupBarChips() {
  chips($("#c-course"), Object.entries(COURSES).map(([k, c]) => [k, `${c.icon} ${c.name}`]), cfg.course, (v) => {
    cfg.course = v;
    saveCfg();
    goStep(0);
  });
  chips($("#c-bgm"), BGMS, cfg.bgm, (v) => {
    cfg.bgm = v;
    saveCfg();
    amb.start(v);
  });
  chips($("#c-timer"), TIMERS, cfg.timer, (v) => {
    cfg.timer = v;
    saveCfg();
    setTimer(v);
  });
}

/* ---------- 진행 ---------- */
const steps = () => COURSES[cfg.course].steps;

function resetProps() {
  S.hideAllProps();
  S.setFoam(S.foamFace, 0);
  S.setFoam(S.foamHair, 0);
  S.pack.material.opacity = 0;
}

function goStep(i) {
  const list = steps();
  if (run.step?.exit) run.step.exit(S, run.st);
  snd.stopTextures();
  run.idx = ((i % list.length) + list.length) % list.length;
  run.step = list[run.idx];
  run.stepT = 0;
  run.st = {};
  resetProps();
  S.setPose(run.step.pose);
  S.setCamera(run.step.cam.focus, run.step.cam.off);
  run.step.enter?.(S, run.st);
  renderHud();
  playStepFile(run.step);
}

// sounds/step-<동작id>.mp3 가 있으면 합성음 대신 실제 녹음 재생
let stepLoop = null;
async function playStepFile(step) {
  stepLoop?.stop();
  stepLoop = null;
  snd.synthOn = true;
  if (!snd.ctx) return;
  const buf = await snd.tryFile(`sounds/step-${step.id}.mp3`);
  if (buf && run.step === step) {
    snd.synthOn = false;
    stepLoop = snd.playLoop(buf, snd.asmr, 1);
  }
}

function renderHud() {
  const c = COURSES[cfg.course];
  $("#now-course").textContent = `${c.icon} ${c.name} · ${run.idx + 1}/${steps().length}`;
  $("#now-step").textContent = run.step.name;
  $("#now-desc").textContent = run.step.desc;
  $("#dots").innerHTML = steps()
    .map((_, i) => `<i class="${i < run.idx ? "done" : i === run.idx ? "on" : ""}"></i>`)
    .join("");
}

/* ---------- 타이머 ---------- */
function setTimer(min) {
  run.endAt = min ? performance.now() + min * 60e3 : 0;
  run.ending = false;
  $("#timer-badge").hidden = !min;
  updateTimerBadge();
}
function updateTimerBadge() {
  if (!run.endAt) return;
  const left = Math.max(0, run.endAt - performance.now());
  const m = Math.floor(left / 60e3), s = Math.floor((left % 60e3) / 1000);
  $("#timer-left").textContent = `${m}:${String(s).padStart(2, "0")}`;
}

const FADE = 20; // 초
function checkTimer() {
  if (!run.endAt || run.ended) return;
  const left = (run.endAt - performance.now()) / 1000;
  if (left <= FADE && !run.ending) {
    run.ending = true;
    snd.fadeMaster(0, Math.max(1, left));
    document.body.classList.add("dimmed");
  }
  if (left <= 0) finish();
}

function finish() {
  run.ended = true;
  amb.stop();
  snd.stopTextures();
  snd.ctx?.suspend();
  $("#end").hidden = false;
  document.body.classList.add("hide-ui");
  // 브라우저가 허용하면 창(탭)을 닫음. 직접 연 탭은 보안상 못 닫을 수 있어서 검은 화면으로 대신해요.
  setTimeout(() => {
    try {
      window.close();
    } catch {}
  }, 1500);
}

$("#b-again").onclick = () => {
  run.ended = false;
  $("#end").hidden = true;
  document.body.classList.remove("hide-ui", "dimmed");
  snd.ctx.resume();
  snd.fadeMaster(1, 1.5);
  amb.start(cfg.bgm);
  setTimer(cfg.timer);
  goStep(run.idx);
};

/* ---------- 컨트롤 ---------- */
$("#go").onclick = () => {
  if (run.started) return;
  saveCfg();
  snd.init();
  snd.resume();
  snd.setAsmrVolume(cfg.asmrVol);
  snd.setBgmVolume(cfg.bgmVol);
  snd.master.gain.value = 0;
  snd.fadeMaster(1, 2);
  amb.start(cfg.bgm);
  setTimer(cfg.timer);
  setupBarChips();
  $("#v-asmr").value = cfg.asmrVol;
  $("#v-bgm").value = cfg.bgmVol;
  $("#start").hidden = true;
  run.started = true;
  goStep(0);
};

$("#b-play").onclick = () => {
  run.paused = !run.paused;
  $("#b-play").textContent = run.paused ? "▶" : "⏸";
  if (run.paused) snd.ctx.suspend();
  else snd.ctx.resume();
};
$("#b-next").onclick = () => goStep(run.idx + 1);
$("#b-prev").onclick = () => goStep(run.idx - 1);
$("#b-more").onclick = () => ($("#more").hidden = !$("#more").hidden);
$("#v-asmr").oninput = (e) => {
  cfg.asmrVol = Number(e.target.value);
  snd.setAsmrVolume(cfg.asmrVol);
  saveCfg();
};
$("#v-bgm").oninput = (e) => {
  cfg.bgmVol = Number(e.target.value);
  snd.setBgmVolume(cfg.bgmVol);
  saveCfg();
};
$("#b-dim").onclick = (e) => {
  document.body.classList.toggle("dimmed");
  e.target.classList.toggle("on", document.body.classList.contains("dimmed"));
};
$("#b-hide").onclick = () => {
  document.body.classList.add("hide-ui");
  $("#more").hidden = true;
};
// 숨긴 상태에서 화면을 누르면 다시 보이기
$("#stage").addEventListener("click", () => {
  if (document.body.classList.contains("hide-ui") && !run.ended) document.body.classList.remove("hide-ui");
});

/* ---------- 루프 ---------- */
function tick(dt, render) {
  run.clock += dt;
  if (run.started && !run.paused && !run.ended) {
    run.stepT += dt;
    if (run.stepT > cfg.len) goStep(run.idx + 1);
    run.step.update(S, snd, run.stepT, dt, run.st);
    checkTimer();
  }
  if (render) S.update(dt, run.clock);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt, true);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 화면이 꺼지거나 탭이 가려져도 소리 변화는 계속 (렌더링만 멈춤)
setInterval(() => {
  if (!document.hidden) return;
  const now = performance.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  tick(dt, false);
}, 100);

setInterval(updateTimerBadge, 1000);

// 시작 전에도 배경 장면은 천천히 보여주기
S.setPose("up");
S.setCamera(COURSES.skin.steps[0].cam.focus, COURSES.skin.steps[0].cam.off);
COURSES.skin.steps[0].enter(S, {});
window.__sleep = { S, run, snd };
