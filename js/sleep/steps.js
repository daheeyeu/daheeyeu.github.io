/* =========================================================
   케어 동작 정의
   각 동작: 손/도구 애니메이션 + 그 움직임에 맞춰 나는 소리
   좌표는 머리 기준(얼굴 +Z, 정수리 +Y, 오른쪽 귀 +X)
   ========================================================= */
import { V, HEAD_R } from "./scene.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
const panOf = (x) => clamp(x * 2.2, -0.95, 0.95);

// 위상이 한 바퀴 돌 때마다 true
function crossed(st, key, phase) {
  const k = Math.floor(phase);
  if (st[key] === undefined) st[key] = k;
  if (k !== st[key]) {
    st[key] = k;
    return true;
  }
  return false;
}

// 손 쉬는 자세 (화면 밖으로 살짝 빼기)
function restHand(S, hand, side) {
  S.aim(hand, V(side * 0.75, 0.25, 0.55), V(-side * 0.6, -0.2, -0.5));
}

/* ---------------- 스킨케어 ---------------- */
const CAM_FACE = { focus: V(0, -0.04, 0.3), off: V(0.35, 1.9, 1.45) };

const skincare = [
  {
    id: "oil",
    name: "클렌징 오일 롤링",
    desc: "따뜻한 오일을 손끝으로 동글동글 굴려요",
    pose: "up",
    cam: CAM_FACE,
    enter(S) {
      S.headband.visible = true;
    },
    update(S, snd, t, dt, st) {
      const w = 3.1;
      let speed = 0;
      [-1, 1].forEach((s) => {
        const cx = s * 0.24 + Math.sin(t * 0.25) * 0.03 * s;
        const cy = -0.1 + Math.sin(t * 0.18) * 0.12;
        const a = t * w * s;
        const tip = S.face(cx + Math.cos(a) * 0.065, cy + Math.sin(a) * 0.065, 0.015);
        const n = tip.clone().normalize();
        const dir = V(-s * 0.1, 1, 0).addScaledVector(n, -0.9).normalize();
        S.aim(s < 0 ? S.handL : S.handR, tip.clone().addScaledVector(dir, -0.17), dir);
        speed = 1;
      });
      snd.texture("oil").set(0.5 + 0.25 * Math.abs(Math.sin(t * w)), 0, 1 + 0.15 * Math.sin(t * w * 2));
      snd.crackle(dt, { rate: 70, pan: Math.sin(t * w) * 0.5, spread: 0.4, fmin: 1500, fmax: 5000, gain: 0.07 });
    },
  },
  {
    id: "foam",
    name: "쫀쫀 거품 세안",
    desc: "몽글몽글 휘핑 거품을 얼굴에 굴려요",
    pose: "up",
    cam: CAM_FACE,
    enter(S) {
      S.headband.visible = true;
    },
    update(S, snd, t, dt, st) {
      const amt = clamp(t / 8, 0, 1);
      S.setFoam(S.foamFace, amt);
      const w = 2.2;
      const regions = [V(0.24, -0.12), V(0, 0.18), V(-0.24, -0.12), V(0, -0.3)];
      const ri = Math.floor(t / 6) % regions.length;
      const c = regions[ri];
      [-1, 1].forEach((s) => {
        const a = t * w * s;
        const cx = ri === 1 || ri === 3 ? c.x + s * 0.12 : c.x + s * 0.06;
        const tip = S.face(cx + Math.cos(a) * 0.07, c.y + Math.sin(a) * 0.06, 0.04);
        const n = tip.clone().normalize();
        const dir = V(0, 1, 0).addScaledVector(n, -0.8).normalize();
        S.aim(s < 0 ? S.handL : S.handR, tip.clone().addScaledVector(dir, -0.17), dir);
      });
      snd.texture("lather").set(0.35 + 0.2 * Math.abs(Math.sin(t * w)), panOf(c.x), 1);
      snd.texture("fizz").set(0.5 * amt, 0, 1);
      snd.crackle(dt, { rate: 380 * amt + 40, pan: panOf(c.x), spread: 0.6, fmin: 2500, fmax: 10000, gain: 0.05 });
      if (crossed(st, "sq", (t * w) / Math.PI)) snd.squish(panOf(c.x), 0.6);
      if (Math.random() < dt * 5) snd.pop((Math.random() - 0.5) * 1.4, 0.8);
    },
  },
  {
    id: "steam",
    name: "따끈한 스팀 타월",
    desc: "따뜻한 타월로 꾹꾹 눌러 거품을 닦아내요",
    pose: "up",
    cam: CAM_FACE,
    enter(S) {
      S.headband.visible = true;
      S.setFoam(S.foamFace, 1);
    },
    update(S, snd, t, dt, st) {
      const on = t > 2 && t < 40;
      S.faceTowel.visible = on;
      S.faceTowel.material.opacity = 1;
      if (on) S.faceTowel.scale.setScalar(1 + 0.012 * Math.sin(t * 2));
      if (t > 4) S.setFoam(S.foamFace, clamp(1 - (t - 4) / 20, 0, 1));
      // 양손으로 꾹… 떼고… 위치 이동
      const press = Math.max(0, Math.sin(t * 1.3));
      const spots = [V(0.25, -0.1), V(-0.25, -0.1), V(0, 0.2), V(0, -0.28)];
      const sp = spots[Math.floor(t / 4.8) % spots.length];
      [-1, 1].forEach((s) => {
        if (!on) return restHand(S, s < 0 ? S.handL : S.handR, s);
        const tip = S.face(sp.x + s * 0.11, sp.y, 0.07 - press * 0.025);
        const n = tip.clone().normalize();
        const dir = V(0, 1, 0).addScaledVector(n, -1.3).normalize();
        S.aim(s < 0 ? S.handL : S.handR, tip.clone().addScaledVector(dir, -0.1).addScaledVector(n, 0.04), dir);
      });
      if (on && crossed(st, "pr", (t * 1.3) / (Math.PI * 2) + 0.25)) snd.press(panOf(sp.x), 0.9);
      snd.texture("towel").set(on ? 0.12 + press * 0.12 : 0, panOf(sp.x), 0.7);
      if (Math.random() < dt * 1.2) snd.drip((Math.random() - 0.5) * 1.6, 0.7);
    },
    exit(S) {
      S.faceTowel.visible = false;
      S.setFoam(S.foamFace, 0);
    },
  },
  {
    id: "pat",
    name: "토너 톡톡 패팅",
    desc: "손끝으로 톡톡톡, 촉촉하게 흡수시켜요",
    pose: "up",
    cam: CAM_FACE,
    enter(S) {
      S.headband.visible = true;
    },
    update(S, snd, t, dt, st) {
      const w = 6.5;
      const route = [V(0.25, -0.12), V(0.12, 0.2), V(-0.12, 0.2), V(-0.25, -0.12), V(0, -0.3)];
      const seg = (t / 3) % route.length;
      const a = route[Math.floor(seg)], b = route[(Math.floor(seg) + 1) % route.length];
      const f = ease(seg % 1);
      const cx = a.x + (b.x - a.x) * f, cy = a.y + (b.y - a.y) * f;
      [-1, 1].forEach((s) => {
        const ph = t * w + (s > 0 ? Math.PI : 0);
        const lift = Math.max(0, Math.sin(ph)) * 0.07;
        const tip = S.face(cx + s * 0.09, cy + s * 0.02, 0.012 + lift);
        const n = tip.clone().normalize();
        const dir = V(0, 1, 0).addScaledVector(n, -1.1).normalize();
        S.aim(s < 0 ? S.handL : S.handR, tip.clone().addScaledVector(dir, -0.17), dir);
        if (crossed(st, "p" + s, ph / (Math.PI * 2))) snd.pat(panOf(cx + s * 0.09), 0.8 + Math.random() * 0.3);
      });
      snd.texture("rub").set(0.05, 0, 1);
    },
  },
  {
    id: "pack",
    name: "모델링팩 브러시",
    desc: "쫀득한 팩을 브러시로 쓱쓱 펴 발라요",
    pose: "up",
    cam: CAM_FACE,
    enter(S, st) {
      S.headband.visible = true;
      S.tools.brush.visible = true;
      S.pack.material.opacity = 0;
    },
    update(S, snd, t, dt, st) {
      const strokeLen = 1.1;
      const k = t / strokeLen;
      const i = Math.floor(k);
      const f = k % 1;
      const rows = [-0.3, -0.18, -0.06, 0.08, 0.2];
      const row = rows[i % rows.length];
      const side = i % 2 ? 1 : -1;
      const x0 = 0.02 * side, x1 = 0.36 * side;
      const press = Math.sin(Math.PI * clamp(f / 0.85, 0, 1));
      const x = x0 + (x1 - x0) * ease(f / 0.85);
      const tip = S.face(x, row + Math.sin(f * 3) * 0.02, 0.02 + (1 - press) * 0.05);
      const n = tip.clone().normalize();
      const dir = V(side, 0.6, 0).addScaledVector(n, -1).normalize();
      S.aim(S.tools.brush, tip, dir);
      S.holdTool(S.handR, tip, dir, 0.24);
      restHand(S, S.handL, -1);
      S.pack.material.opacity = clamp(t / 25, 0, 0.95);
      snd.texture("bristle").set(press * 0.55, panOf(x), 0.9 + f * 0.3);
      snd.crackle(dt, { rate: 260 * press, pan: panOf(x), spread: 0.2, fmin: 3000, fmax: 9000, gain: 0.05 });
      if (crossed(st, "st", k)) snd.squish(panOf(x0), 0.35);
    },
    exit(S) {
      S.tools.brush.visible = false;
    },
  },
  {
    id: "gua",
    name: "괄사 페이스 라인",
    desc: "매끈한 괄사로 턱선을 따라 쓸어 올려요",
    pose: "up",
    cam: CAM_FACE,
    enter(S) {
      S.headband.visible = true;
      S.tools.gua.visible = true;
      S.pack.material.opacity = 0;
    },
    update(S, snd, t, dt, st) {
      const len = 2.2;
      const k = t / len;
      const i = Math.floor(k);
      const f = k % 1;
      const side = i % 2 ? 1 : -1;
      const paths = [
        [V(0.06, -0.36), V(0.42, -0.06)],
        [V(0.12, -0.16), V(0.42, 0.04)],
        [V(0.08, 0.2), V(0.36, 0.22)],
      ];
      const [a, b] = paths[Math.floor(i / 2) % paths.length];
      const g = ease(f / 0.8);
      const x = side * (a.x + (b.x - a.x) * g);
      const y = a.y + (b.y - a.y) * g;
      const lift = f > 0.8 ? (f - 0.8) * 0.4 : 0;
      const p = S.face(x, y, 0.012 + lift);
      const n = p.clone().normalize();
      S.tools.gua.position.copy(p);
      S.tools.gua.lookAt(S.head.localToWorld(p.clone().add(n)));
      S.tools.gua.rotateZ(Math.atan2(b.y - a.y, side * (b.x - a.x)));
      const dir = V(side * (b.x - a.x), b.y - a.y, 0).normalize().addScaledVector(n, -0.5).normalize();
      S.aim(S.handR, p.clone().addScaledVector(n, 0.06).addScaledVector(dir, -0.12), dir);
      restHand(S, S.handL, -1);
      const moving = f < 0.8 ? Math.sin(Math.PI * (f / 0.8)) : 0;
      snd.texture("glide").set(0.6 * moving, panOf(x), 0.8 + g * 0.6);
      snd.texture("oil").set(0.15 * moving, panOf(x), 1.3);
    },
    exit(S) {
      S.tools.gua.visible = false;
    },
  },
  {
    id: "cream",
    name: "수분 크림 톡톡",
    desc: "크림을 콕콕 찍어 부드럽게 펴 발라요",
    pose: "up",
    cam: CAM_FACE,
    enter(S) {
      S.headband.visible = true;
    },
    update(S, snd, t, dt, st) {
      const spots = [V(0, 0.2), V(-0.24, -0.08), V(0.24, -0.08), V(0, -0.06), V(0, -0.3)];
      const cyc = 9;
      const ph = t % cyc;
      if (ph < 4) {
        // 점 찍기
        const idx = Math.floor(ph / 0.8);
        const s = spots[idx % spots.length];
        const f = (ph / 0.8) % 1;
        const lift = Math.abs(Math.cos(Math.PI * f)) * 0.08;
        const tip = S.face(s.x, s.y, 0.012 + lift);
        const n = tip.clone().normalize();
        const dir = V(0.2, 1, 0).addScaledVector(n, -1.2).normalize();
        S.aim(S.handR, tip.clone().addScaledVector(dir, -0.17), dir);
        restHand(S, S.handL, -1);
        if (crossed(st, "dot", ph / 0.8 + 0.5)) snd.cream(panOf(s.x));
        snd.texture("rub").set(0, 0, 1);
      } else {
        // 양손으로 펴 바르기
        const w = 2.4;
        [-1, 1].forEach((s) => {
          const a = t * w * s;
          const tip = S.face(s * 0.2 + Math.cos(a) * 0.08, -0.05 + Math.sin(a) * 0.12, 0.015);
          const n = tip.clone().normalize();
          const dir = V(0, 1, 0).addScaledVector(n, -0.9).normalize();
          S.aim(s < 0 ? S.handL : S.handR, tip.clone().addScaledVector(dir, -0.17), dir);
        });
        snd.texture("rub").set(0.35, 0, 1.2);
        snd.crackle(dt, { rate: 40, spread: 0.6, fmin: 1500, fmax: 4000, gain: 0.08 });
      }
    },
  },
];

/* ---------------- 귀 케어 (side: +1 오른쪽, -1 왼쪽) ---------------- */
function earSteps(side) {
  const pose = side > 0 ? "sideR" : "sideL";
  const sideName = side > 0 ? "오른쪽" : "왼쪽";
  const E = V(side * 0.575, -0.035, 0.0); // 귓구멍 입구
  const out = V(side, 0, 0);
  const cam = { focus: E.clone().add(V(0, 0, 0.02)), off: V(0.65, 1.45, 0.9) };
  const pan = side * 0.92;
  const intoEar = V(-side * 0.45, -0.6, -side * 0.65).normalize(); // 손잡이가 카메라 반대쪽으로

  return [
    {
      id: "earmassage" + side,
      name: `${sideName} 귀 마사지`,
      desc: "귓바퀴를 살살 접었다 펴며 풀어줘요",
      pose,
      cam,
      enter(S) {
        S.headband.visible = false;
      },
      update(S, snd, t, dt, st) {
        const w = 2.2;
        const a = t * w;
        const tip = E.clone().add(V(side * 0.075, Math.sin(a) * 0.075, Math.cos(a) * 0.065));
        S.aim(S.handR, tip.clone().addScaledVector(V(side, 0.5, 0.2).normalize(), 0.16), V(-side, -0.5, -0.2).normalize());
        const tip2 = E.clone().add(V(side * 0.06, -Math.sin(a) * 0.06, -Math.cos(a) * 0.06 - 0.02));
        S.aim(S.handL, tip2.clone().addScaledVector(V(side, -0.4, -0.3).normalize(), 0.16), V(-side, 0.4, 0.3).normalize());
        const sp = 0.55 + 0.45 * Math.abs(Math.sin(a * 2));
        snd.texture("rub").set(0.75 * sp, pan, 0.9 + 0.3 * Math.sin(a));
        snd.crackle(dt, { rate: 90 * sp, pan, spread: 0.1, fmin: 1200, fmax: 5000, gain: 0.16 });
      },
    },
    {
      id: "earpick" + side,
      name: `${sideName} 귀이개 사각사각`,
      desc: "귀이개로 입구를 살살 긁어내요",
      pose,
      cam: { focus: E.clone(), off: V(0.5, 1.15, 0.7) },
      enter(S) {
        S.headband.visible = false;
        S.tools.pick.visible = true;
      },
      update(S, snd, t, dt, st) {
        const rate = 1.7;
        const k = t * rate;
        const f = k % 1;
        // 살짝 넣고(0~0.35) 긁으면서 빼기(0.35~1)
        const depth = f < 0.35 ? ease(f / 0.35) : 1 - ease((f - 0.35) / 0.65);
        const ang = t * 0.6;
        const wob = V(0, Math.sin(ang) * 0.014, Math.cos(ang * 1.3) * 0.012);
        const tip = E.clone().addScaledVector(out, 0.015 - depth * 0.028).add(wob);
        S.aim(S.tools.pick, tip, intoEar, Math.sin(t * 2) * 0.3);
        S.holdTool(S.handR, tip, intoEar, 0.28);
        // 왼손은 귓바퀴를 살짝 당김
        const pull = E.clone().add(V(side * 0.05, 0.11, -0.03));
        S.aim(S.handL, pull.clone().addScaledVector(V(side * 0.5, 1, 0.3).normalize(), 0.15), V(-side * 0.5, -1, -0.3).normalize());
        if (crossed(st, "sc", k - 0.4)) snd.scratch(pan, 0.8 + Math.random() * 0.4);
        if (Math.random() < dt * 2.5) snd.scratch(pan, 0.25);
        snd.texture("rub").set(0.06 + depth * 0.08, pan, 1.4);
      },
      exit(S) {
        S.tools.pick.visible = false;
      },
    },
    {
      id: "bonbon" + side,
      name: `${sideName} 솜털 봉`,
      desc: "보송보송 솜털로 귓속을 사르륵 돌려요",
      pose,
      cam: { focus: E.clone(), off: V(0.5, 1.15, 0.7) },
      enter(S) {
        S.headband.visible = false;
        S.tools.bonbon.visible = true;
      },
      update(S, snd, t, dt, st) {
        const spin = t * 7;
        const depth = 0.5 + 0.5 * Math.sin(t * 0.9);
        const tip = E.clone().addScaledVector(out, 0.03 - depth * 0.025).add(V(0, Math.sin(t * 1.3) * 0.01, Math.cos(t) * 0.01));
        S.aim(S.tools.bonbon, tip, intoEar, spin);
        S.puff.rotation.z = spin;
        S.holdTool(S.handR, tip, intoEar, 0.27, spin * 0.1);
        restHand(S, S.handL, -side);
        const lvl = 0.45 + 0.35 * Math.abs(Math.sin(t * 3.5));
        snd.texture("fluff").set(lvl * (0.6 + depth * 0.5), pan, 0.85 + depth * 0.35);
        snd.crackle(dt, { rate: 220 * lvl, pan, spread: 0.08, fmin: 3000, fmax: 9500, gain: 0.05 });
      },
      exit(S) {
        S.tools.bonbon.visible = false;
      },
    },
    {
      id: "earpress" + side,
      name: `${sideName} 귀 주변 지압`,
      desc: "귀 주변을 꾹— 꾹— 천천히 눌러줘요",
      pose,
      cam,
      enter(S) {
        S.headband.visible = false;
      },
      update(S, snd, t, dt, st) {
        const w = 1.4;
        const pts = [V(0, 0.13, 0.06), V(0, 0.02, 0.13), V(0, -0.13, 0.06), V(0, -0.02, -0.12)];
        const idx = Math.floor((t * w) / (Math.PI * 2)) % pts.length;
        const press = Math.max(0, Math.sin(t * w));
        const base = E.clone().add(pts[idx]);
        base.x = side * Math.sqrt(Math.max(0, HEAD_R ** 2 - base.y ** 2 - base.z ** 2));
        const n = base.clone().normalize();
        const tip = base.clone().addScaledVector(n, 0.05 - press * 0.03);
        S.aim(S.handR, tip.clone().addScaledVector(n, 0.14), n.clone().negate());
        restHand(S, S.handL, -side);
        if (crossed(st, "pr", (t * w) / (Math.PI * 2) + 0.25)) snd.press(pan, 1);
        snd.texture("rub").set(0.25 * press, pan, 0.7);
      },
    },
  ];
}

/* ---------------- 머리 감기 · 두피 케어 ---------------- */
const CAM_HAIR = { focus: V(0.05, 0.25, 0.05), off: V(1.75, 1.35, -0.75) };

function scrubHands(S, t, w, amp, centerA, centerB) {
  [-1, 1].forEach((s) => {
    const a = centerA + Math.sin(t * w + (s > 0 ? 1.5 : 0)) * amp;
    const b = s * centerB + Math.cos(t * w * 1.3 + s) * amp;
    const tip = S.scalp(a, b, 0.05);
    const n = tip.clone().normalize();
    const dir = V(0, 0, -0.7).addScaledVector(n, -1).normalize();
    S.aim(s < 0 ? S.handL : S.handR, tip.clone().addScaledVector(dir, -0.17).addScaledVector(n, 0.03), dir);
  });
}

function showerAt(S, t) {
  const headW = S.head.getWorldPosition(V());
  const noz = headW.add(V(Math.sin(t * 0.5) * 0.25, 0.85, -0.45 + Math.cos(t * 0.4) * 0.12));
  S.setWater(true, noz);
  return Math.sin(t * 0.5) * 0.25;
}

const hair = [
  {
    id: "wet",
    name: "따뜻한 물 적시기",
    desc: "샤워기로 머리를 촉촉하게 적셔요",
    pose: "wash",
    cam: CAM_HAIR,
    enter(S) {
      S.headband.visible = false;
    },
    update(S, snd, t, dt, st) {
      const x = showerAt(S, t);
      const a = -0.45 + ((t * 0.6) % 1) * 0.8;
      const tip = S.scalp(a, 0.35 + Math.sin(t * 0.5) * 0.45, 0.06);
      const n = tip.clone().normalize();
      const dir = V(0, -0.3, -1).addScaledVector(n, -0.5).normalize();
      S.aim(S.handR, tip.clone().addScaledVector(dir, -0.17), dir);
      restHand(S, S.handL, -1);
      snd.texture("water").set(0.55, panOf(x), 1);
      snd.crackle(dt, { rate: 160, pan: panOf(x), spread: 0.5, fmin: 1500, fmax: 7000, gain: 0.06 });
      if (Math.random() < dt * 6) snd.drip((Math.random() - 0.5) * 1.6, 0.6);
    },
    exit(S) {
      S.setWater(false);
    },
  },
  {
    id: "lather",
    name: "샴푸 거품 마사지",
    desc: "손끝으로 박박, 거품이 몽글몽글",
    pose: "wash",
    cam: CAM_HAIR,
    enter(S) {
      S.headband.visible = false;
    },
    update(S, snd, t, dt, st) {
      const amt = clamp(t / 10, 0.05, 1);
      S.setFoam(S.foamHair, amt);
      const w = 7;
      const cA = -0.1 + Math.sin(t * 0.3) * 0.25;
      const cB = 0.6 + Math.sin(t * 0.2) * 0.2;
      scrubHands(S, t, w, 0.08, cA, cB);
      const lvl = 0.5 + 0.3 * Math.abs(Math.sin(t * w));
      snd.texture("lather").set(lvl * 0.8, Math.sin(t * w) * 0.5, 1 + 0.2 * Math.sin(t * w));
      snd.texture("fizz").set(0.35 * amt, 0, 1);
      snd.crackle(dt, { rate: 450 * amt, pan: 0, spread: 0.9, fmin: 2000, fmax: 9500, gain: 0.05 });
      if (crossed(st, "sq", (t * w) / Math.PI)) snd.squish(Math.random() < 0.5 ? -0.6 : 0.6, 0.45);
    },
  },
  {
    id: "scalpbrush",
    name: "두피 브러시 슥슥",
    desc: "실리콘 브러시로 두피를 시원하게",
    pose: "wash",
    cam: CAM_HAIR,
    enter(S) {
      S.headband.visible = false;
      S.tools.scalpBrush.visible = true;
      S.setFoam(S.foamHair, 1);
    },
    update(S, snd, t, dt, st) {
      S.setFoam(S.foamHair, 1);
      const w = 3.2;
      const zig = Math.sin(t * w);
      const a = -0.45 + ((t * 0.12) % 1) * 0.8;
      const b = zig * 0.9;
      const tip = S.scalp(a, b, 0.07);
      const n = tip.clone().normalize();
      S.aim(S.tools.scalpBrush, tip, n.clone().negate(), zig * 0.4);
      S.aim(S.handR, tip.clone().addScaledVector(n, 0.1), n.clone().negate().add(V(0, 0, -0.4)).normalize());
      restHand(S, S.handL, -1);
      if (crossed(st, "z", (t * w) / Math.PI + 0.5)) snd.brushStroke(panOf(Math.sin(b) * 0.5), 1);
      snd.crackle(dt, { rate: 200 * Math.abs(Math.cos(t * w)), pan: panOf(Math.sin(b) * 0.5), spread: 0.2, fmin: 2500, fmax: 9000, gain: 0.07 });
      snd.texture("fizz").set(0.25, 0, 1);
    },
    exit(S) {
      S.tools.scalpBrush.visible = false;
    },
  },
  {
    id: "rinse",
    name: "깨끗하게 헹구기",
    desc: "거품을 샤아— 시원하게 헹궈내요",
    pose: "wash",
    cam: CAM_HAIR,
    enter(S) {
      S.headband.visible = false;
    },
    update(S, snd, t, dt, st) {
      const x = showerAt(S, t);
      S.setFoam(S.foamHair, clamp(1 - t / 18, 0, 1));
      scrubHands(S, t, 2.2, 0.15, -0.1, 0.65);
      snd.texture("water").set(0.6, panOf(x), 0.95);
      snd.texture("lather").set(0.2 * clamp(1 - t / 18, 0, 1), 0, 0.8);
      snd.crackle(dt, { rate: 180, pan: panOf(x), spread: 0.6, fmin: 1500, fmax: 8000, gain: 0.06 });
      if (Math.random() < dt * 6) snd.drip((Math.random() - 0.5) * 1.6, 0.7);
    },
    exit(S) {
      S.setWater(false);
      S.setFoam(S.foamHair, 0);
    },
  },
  {
    id: "scalppress",
    name: "두피 지압 마사지",
    desc: "열 손가락으로 꾹— 지그시 눌러 풀어요",
    pose: "wash",
    cam: CAM_HAIR,
    enter(S) {
      S.headband.visible = false;
      S.setFoam(S.foamHair, 0);
    },
    update(S, snd, t, dt, st) {
      const w = 1.2;
      const press = Math.max(0, Math.sin(t * w));
      const idx = Math.floor((t * w) / (Math.PI * 2));
      const a = -0.4 + (idx % 4) * 0.2;
      [-1, 1].forEach((s) => {
        const tip = S.scalp(a, s * (0.5 + (idx % 2) * 0.3), 0.08 - press * 0.035);
        const n = tip.clone().normalize();
        const dir = V(0, 0, -0.7).addScaledVector(n, -1).normalize();
        S.aim(s < 0 ? S.handL : S.handR, tip.clone().addScaledVector(dir, -0.17), dir);
      });
      if (crossed(st, "p", (t * w) / (Math.PI * 2) + 0.25)) snd.press(0, 1);
      snd.texture("rub").set(0.3 * press, 0, 0.8);
      snd.crackle(dt, { rate: 60 * press, spread: 0.9, fmin: 2000, fmax: 7000, gain: 0.07 });
    },
  },
  {
    id: "towel",
    name: "수건으로 보송하게",
    desc: "도톰한 수건으로 톡톡, 비벼서 말려요",
    pose: "wash",
    cam: CAM_HAIR,
    enter(S) {
      S.headband.visible = false;
    },
    update(S, snd, t, dt, st) {
      S.hairTowel.visible = true;
      const w = 4.5;
      const rubX = Math.sin(t * w) * 0.04;
      S.hairTowel.rotation.set(-0.9 + Math.sin(t * w) * 0.03, 0, rubX);
      scrubHands(S, t, w, 0.06, -0.1, 0.65);
      const lvl = 0.4 + 0.35 * Math.abs(Math.sin(t * w));
      snd.texture("towel").set(lvl, Math.sin(t * w) * 0.4, 1);
      snd.crackle(dt, { rate: 160 * lvl, spread: 0.7, fmin: 1500, fmax: 6000, gain: 0.06 });
    },
    exit(S) {
      S.hairTowel.visible = false;
    },
  },
];

const ear = [...earSteps(1), ...earSteps(-1)];
const byId = (arr, id) => arr.find((x) => x.id === id);

export const COURSES = {
  skin: { name: "스킨케어", icon: "🧖", desc: "클렌징 · 거품 세안 · 스팀 타월 · 패팅 · 팩 · 괄사 · 크림", steps: skincare },
  ear: { name: "귀 청소", icon: "👂", desc: "귀 마사지 · 귀이개 사각사각 · 솜털 봉 · 지압 (양쪽)", steps: ear },
  hair: { name: "머리 감기 · 두피", icon: "🚿", desc: "물 적시기 · 샴푸 거품 · 두피 브러시 · 헹굼 · 지압 · 수건", steps: hair },
  all: {
    name: "통합 코스",
    icon: "🌙",
    desc: "스킨케어 → 귀 청소 → 머리 감기까지 한 번에",
    steps: [
      byId(skincare, "oil"),
      byId(skincare, "foam"),
      byId(skincare, "steam"),
      byId(skincare, "pack"),
      byId(skincare, "gua"),
      byId(ear, "earpick1"),
      byId(ear, "bonbon1"),
      byId(ear, "earpick-1"),
      byId(ear, "bonbon-1"),
      byId(hair, "wet"),
      byId(hair, "lather"),
      byId(hair, "scalpbrush"),
      byId(hair, "rinse"),
      byId(hair, "towel"),
    ],
  },
};
