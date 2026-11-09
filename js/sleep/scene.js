/* =========================================================
   3D 장면: 귀여운 손님 캐릭터 + 관리사 손 + 도구들
   머리(head) 기준 좌표: 얼굴 +Z, 정수리 +Y, 오른쪽 귀 +X
   ========================================================= */
import * as THREE from "../vendor/three.module.min.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

export const HEAD_R = 0.5;

// 포즈: 캐릭터 전체 회전
const POSES = {
  up: new THREE.Euler(-Math.PI / 2, 0, 0, "XYZ"),
  sideR: new THREE.Euler(-Math.PI / 2, -Math.PI / 2, 0, "XYZ"),
  sideL: new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0, "XYZ"),
  wash: new THREE.Euler(-Math.PI / 2 - 0.12, 0, 0, "XYZ"),
};

export class BeautyScene {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color("#f6d9e2");
    scene.fog = new THREE.Fog("#f6d9e2", 6, 14);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
    this.camera.position.set(0.4, 2.6, 1.8);
    this.camTarget = V(0, 1, 0);
    this.camGoalPos = this.camera.position.clone();
    this.camGoalTarget = this.camTarget.clone();

    this._lights();
    this._room();
    this._character();
    this._hands();
    this._tools();
    this._effects();

    this.poseQ = new THREE.Quaternion().setFromEuler(POSES.up);
    this.root.quaternion.copy(this.poseQ);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  /* ---------------- 기본 세팅 ---------------- */
  _lights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight("#fff3f6", "#c79a8a", 1.1));
    const key = new THREE.DirectionalLight("#fff1e0", 1.6);
    key.position.set(2.5, 5, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    key.shadow.bias = -0.0015;
    key.shadow.radius = 4;
    s.add(key);
    this.lamp = new THREE.PointLight("#ffb46b", 1.2, 6, 1.6);
    this.lamp.position.set(-1.8, 1.6, -1.4);
    s.add(this.lamp);
  }

  _room() {
    const s = this.scene;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mat("#e9c7b5"));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), mat("#f8dbe4"));
    wall.position.set(0, 4, -3.2);
    s.add(wall);

    // 침대
    const bed = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.38, 4.2), mat("#d7a07a"));
    frame.position.y = 0.19;
    const mat2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 4.0), mat("#fff8f3"));
    mat2.position.y = 0.44;
    [frame, mat2].forEach((m) => {
      m.castShadow = m.receiveShadow = true;
      bed.add(m);
    });
    bed.position.set(0, 0, 1.25);
    s.add(bed);

    // 베개
    this.pillow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), mat("#cfeefe"));
    this.pillow.scale.set(1.25, 0.18, 0.75);
    this.pillow.position.set(0, 0.55, -0.05);
    this.pillow.receiveShadow = true;
    s.add(this.pillow);

    // 샴푸 세면대 (머리감기 코스)
    const basin = (this.basin = new THREE.Group());
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat("#ffffff", { side: THREE.DoubleSide, roughness: 0.3 }));
    bowl.scale.set(1, 0.55, 1);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 12, 48), mat("#ffffff", { roughness: 0.3 }));
    rim.rotation.x = Math.PI / 2;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.6, 20), mat("#f3b6c8"));
    stand.position.y = -0.6;
    basin.add(bowl, rim, stand);
    basin.position.set(0, 0.62, -0.25);
    basin.traverse((m) => m.isMesh && (m.receiveShadow = true));
    basin.visible = false;
    s.add(basin);

    // 소품: 화분, 스탠드, 선반 위 화장품
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.35, 16), mat("#e88f6a"));
    pot.position.set(-1.9, 0.18, -2.2);
    s.add(pot);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat("#7cc48d"));
      leaf.position.set(-1.9 + Math.sin(i * 1.1) * 0.18, 0.55 + (i % 3) * 0.18, -2.2 + Math.cos(i * 1.1) * 0.18);
      leaf.scale.set(1, 1.3, 1);
      s.add(leaf);
    }
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), mat("#9b6b52"));
    lampPole.position.set(-1.8, 0.7, -1.4);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.32, 20, 1, true), mat("#fff2d6", { emissive: "#ffcf8a", emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    shade.position.set(-1.8, 1.55, -1.4);
    s.add(lampPole, shade);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.35), mat("#d7a07a"));
    shelf.position.set(1.6, 1.4, -3.0);
    s.add(shelf);
    const colors = ["#ffb3c7", "#bfe8ff", "#c8f0c4", "#fff0a8", "#e0c8ff"];
    colors.forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.25 + (i % 2) * 0.1, 14), mat(c, { roughness: 0.35 }));
      b.position.set(1.0 + i * 0.3, 1.55 + (i % 2) * 0.05, -2.95);
      s.add(b);
    });
    // 촛불
    this.candle = new THREE.PointLight("#ff9a4a", 0.6, 3, 2);
    this.candle.position.set(1.2, 0.9, -1.6);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 14), mat("#fff6ea"));
    candle.position.set(1.2, 0.68, -1.6);
    const flame = (this.flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: "#ffcf66" })));
    flame.scale.set(1, 1.8, 1);
    flame.position.set(1.2, 0.81, -1.6);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 20), mat("#f1c0a5"));
    table.position.set(1.2, 0.3, -1.6);
    s.add(this.candle, candle, flame, table);
  }

  _character() {
    const root = (this.root = new THREE.Group());
    root.position.set(0, 1.05, 0);
    this.scene.add(root);

    const skin = mat("#ffdcc6", { roughness: 0.65 });
    const head = (this.head = new THREE.Group());
    root.add(head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 48, 32), skin);
    skull.scale.set(1, 0.98, 0.98);
    skull.castShadow = true;
    head.add(skull);

    // 머리카락: 정수리 캡 + 뒷머리 + 앞머리
    const hairMat = (this.hairMat = mat("#5b3a2e", { roughness: 0.55 }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R + 0.03, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
    cap.rotation.x = -0.42;
    cap.castShadow = true;
    const back = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R + 0.025, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    back.rotation.x = -1.45;
    back.position.set(0, -0.02, -0.02);
    head.add(cap, back);
    this.bangs = new THREE.Group();
    [-0.22, -0.08, 0.07, 0.2].forEach((x, i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), hairMat);
      b.scale.set(1.1, 0.8, 0.55);
      const p = V(x, 0.3 - Math.abs(x) * 0.25 + (i % 2) * 0.02, 0).setLength(1);
      p.z = Math.sqrt(Math.max(0, 1 - p.x * p.x - p.y * p.y));
      b.position.copy(V(x, 0.31 - Math.abs(x) * 0.2, Math.sqrt(Math.max(0, (HEAD_R + 0.01) ** 2 - x * x - 0.31 ** 2))));
      b.lookAt(b.position.clone().multiplyScalar(2));
      this.bangs.add(b);
    });
    head.add(this.bangs);

    // 얼굴: 감은 눈(잠든 표정), 볼터치, 코, 입
    const dark = new THREE.MeshBasicMaterial({ color: "#4a2a2a" });
    this.eyes = [];
    [-1, 1].forEach((s) => {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.011, 8, 16, Math.PI), dark);
      eye.position.set(s * 0.17, 0.0, 0.468);
      eye.rotation.set(-0.05, s * 0.32, Math.PI);
      head.add(eye);
      this.eyes.push(eye);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshBasicMaterial({ color: "#ff9fb0", transparent: true, opacity: 0.55 }));
      const bp = V(s * 0.28, -0.11, 0).setY(-0.11);
      bp.z = Math.sqrt(HEAD_R ** 2 - bp.x ** 2 - bp.y ** 2) + 0.004;
      blush.position.copy(bp);
      blush.lookAt(bp.clone().multiplyScalar(2));
      head.add(blush);
      // 귀
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), skin);
      ear.scale.set(0.45, 1, 0.75);
      ear.position.set(s * 0.53, -0.03, -0.01);
      ear.castShadow = true;
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mat("#f2a99a"));
      inner.scale.set(0.35, 1, 0.7);
      inner.position.set(s * 0.568, -0.035, 0.0);
      head.add(ear, inner);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), mat("#ffc4ad"));
    nose.position.set(0, -0.07, 0.5);
    const mouth = (this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: "#c0506a" })));
    mouth.position.set(0, -0.2, 0.455);
    mouth.rotation.set(-0.35, 0, Math.PI);
    head.add(nose, mouth);

    // 헤어밴드 + 리본 (스킨케어용)
    this.headband = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(HEAD_R + 0.035, 0.05, 12, 48), mat("#ffc2d4"));
    band.rotation.set(Math.PI / 2 - 0.5, 0, 0);
    band.position.set(0, 0.12, -0.04);
    const bow = new THREE.Group();
    [-1, 1].forEach((s) => {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), mat("#ffc2d4"));
      lobe.scale.set(1.3, 0.8, 0.5);
      lobe.position.set(s * 0.09, 0, 0);
      bow.add(lobe);
    });
    bow.position.set(0.12, 0.45, 0.2);
    bow.rotation.x = -0.6;
    this.headband.add(band, bow);
    head.add(this.headband);

    // 몸: 목, 가운 입은 몸통, 이불
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 16), skin);
    neck.position.set(0, -0.55, -0.08);
    const robe = mat("#ffb9cf");
    const torso = (this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.55, 8, 20), robe));
    torso.scale.set(1.35, 1, 0.75);
    torso.position.set(0, -1.05, -0.12);
    torso.castShadow = true;
    const blanket = (this.blanket = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat("#fff1c9")));
    blanket.scale.set(0.78, 1.15, 0.42);
    blanket.position.set(0, -1.95, -0.1);
    blanket.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 10, 40), mat("#ffc9a0"));
    stripe.scale.set(1.05, 0.55, 1);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.set(0, -1.2, -0.05);
    root.add(neck, torso, blanket);
  }

  _hand(color) {
    const g = new THREE.Group();
    const glove = mat(color, { roughness: 0.5 });
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), glove);
    palm.scale.set(1.05, 0.45, 1.2);
    g.add(palm);
    [-0.06, -0.02, 0.02, 0.06].forEach((x, i) => {
      const len = [0.07, 0.09, 0.085, 0.065][i];
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, len, 4, 10), glove);
      f.rotation.x = Math.PI / 2;
      f.position.set(x, 0, 0.1 + len / 2);
      g.add(f);
    });
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.06, 4, 10), glove);
    thumb.rotation.set(Math.PI / 2, 0, 0.9);
    thumb.position.set(0.1, 0.01, 0.05);
    g.add(thumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.12, 16), mat("#ffffff"));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = -0.14;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.4, 16), mat("#a9dcc9"));
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.z = -0.4;
    g.add(cuff, sleeve);
    g.traverse((m) => m.isMesh && (m.castShadow = true));
    return g;
  }

  _hands() {
    this.handL = this._hand("#e8f6ff");
    this.handR = this._hand("#e8f6ff");
    this.head.add(this.handL, this.handR);
    this.handL.position.set(-0.6, 0.6, 0.6);
    this.handR.position.set(0.6, 0.6, 0.6);
  }

  _tools() {
    const T = (this.tools = {});
    const H = this.head;
    // 모든 도구는 원점=끝(팁), 몸체는 -Z 방향
    // 대나무 귀이개
    const pick = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.36, 10), mat("#d9b26a"));
    stick.rotation.x = Math.PI / 2;
    stick.position.z = -0.18;
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#c79b52", { side: THREE.DoubleSide }));
    scoop.rotation.x = Math.PI / 2;
    const fluffEnd = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), mat("#ffffff", { roughness: 1 }));
    fluffEnd.position.z = -0.37;
    pick.add(stick, scoop, fluffEnd);
    T.pick = pick;

    // 솜털 봉 (본텐)
    const bonbon = new THREE.Group();
    const bstick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.34, 10), mat("#d9b26a"));
    bstick.rotation.x = Math.PI / 2;
    bstick.position.z = -0.2;
    const puff = (this.puff = new THREE.Group());
    for (let i = 0; i < 26; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), mat("#ffffff", { roughness: 1 }));
      const d = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).setLength(0.022 + Math.random() * 0.012);
      f.position.copy(d);
      puff.add(f);
    }
    puff.position.z = -0.01;
    bonbon.add(bstick, puff);
    T.bonbon = bonbon;

    // 팩 브러시
    const brush = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.28, 12), mat("#ffffff", { roughness: 0.3 }));
    handle.rotation.x = Math.PI / 2;
    handle.position.z = -0.2;
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 12), mat("#e7c7d0", { metalness: 0.6, roughness: 0.3 }));
    ferrule.rotation.x = Math.PI / 2;
    ferrule.position.z = -0.065;
    const bristle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.016, 0.05), mat("#f5f0e6", { roughness: 1 }));
    bristle.position.z = -0.025;
    const packOnBrush = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.018, 0.02), mat("#9cc79a"));
    packOnBrush.position.z = -0.008;
    brush.add(handle, ferrule, bristle, packOnBrush);
    T.brush = brush;

    // 괄사 (로즈쿼츠)
    const gua = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 12), mat("#ffc8d6", { roughness: 0.15, transparent: true, opacity: 0.92 }));
    stone.scale.set(1.2, 0.75, 0.16);
    gua.add(stone);
    T.gua = gua;

    // 실리콘 두피 브러시
    const sb = new THREE.Group();
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat("#8fd3e8", { roughness: 0.4 }));
    base.rotation.x = -Math.PI / 2;
    base.position.z = -0.03;
    sb.add(base);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = i % 2 ? 0.05 : 0.025;
      const nub = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.02, 3, 6), mat("#5cbad6"));
      nub.rotation.x = Math.PI / 2;
      nub.position.set(Math.cos(a) * r, Math.sin(a) * r, -0.012);
      sb.add(nub);
    }
    T.scalpBrush = sb;

    // 크림 통 & 스팀 타월 등은 effects 에서
    Object.values(T).forEach((t) => {
      t.visible = false;
      t.traverse((m) => m.isMesh && (m.castShadow = true));
      H.add(t);
    });
  }

  _effects() {
    const H = this.head;
    // 얼굴 팩 레이어
    const packGeo = new THREE.SphereGeometry(HEAD_R + 0.012, 40, 24, Math.PI / 2 - 0.95, 1.9, 0.82, 1.42);
    this.pack = new THREE.Mesh(packGeo, mat("#a8cf9f", { transparent: true, opacity: 0, roughness: 0.9 }));
    H.add(this.pack);

    // 스팀 타월 (얼굴)
    const towelGeo = new THREE.SphereGeometry(HEAD_R + 0.045, 40, 24, Math.PI / 2 - 1.15, 2.3, 0.55, 1.95);
    this.faceTowel = new THREE.Mesh(towelGeo, mat("#ffffff", { roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 1 }));
    this.faceTowel.visible = false;
    H.add(this.faceTowel);

    // 머리 타월
    const hairTowelGeo = new THREE.SphereGeometry(HEAD_R + 0.09, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.6);
    this.hairTowel = new THREE.Mesh(hairTowelGeo, mat("#fff4f8", { roughness: 1, side: THREE.DoubleSide }));
    this.hairTowel.rotation.x = -0.9;
    this.hairTowel.visible = false;
    H.add(this.hairTowel);

    // 거품 (인스턴스)
    const bubbleGeo = new THREE.SphereGeometry(1, 10, 8);
    const foamMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.25, transparent: true, opacity: 0.92 });
    const makeFoam = (count, pickPoint) => {
      const m = new THREE.InstancedMesh(bubbleGeo, foamMat.clone(), count);
      m.count = 0;
      m.frustumCulled = false;
      m.userData.points = Array.from({ length: count }, () => {
        const p = pickPoint();
        return { p, s: 0.012 + Math.random() * 0.03, grow: Math.random() };
      });
      H.add(m);
      return m;
    };
    this.foamFace = makeFoam(220, () => {
      for (;;) {
        const x = (Math.random() * 2 - 1) * 0.42;
        const y = -0.36 + Math.random() * 0.58;
        const r = HEAD_R + 0.01;
        if (x * x + y * y > r * r * 0.86) continue;
        if (Math.abs(y - 0.0) < 0.07 && Math.abs(x) > 0.08 && Math.abs(x) < 0.27) continue; // 눈 피하기
        return V(x, y, Math.sqrt(r * r - x * x - y * y));
      }
    });
    this.foamHair = makeFoam(320, () => {
      for (;;) {
        const d = V(Math.random() * 2 - 1, Math.random() * 1.2 - 0.2, Math.random() * 2 - 1.2);
        if (d.length() < 0.2) continue;
        d.normalize();
        if (d.z > 0.45 && d.y < 0.55) continue; // 얼굴 피하기
        return d.multiplyScalar(HEAD_R + 0.05);
      }
    });

    // 물줄기 (월드 좌표)
    const N = 260;
    const geo = new THREE.BufferGeometry();
    this.waterPos = new Float32Array(N * 3);
    this.waterVel = new Float32Array(N * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(this.waterPos, 3));
    this.water = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#bfe9ff", size: 0.028, transparent: true, opacity: 0.85, depthWrite: false }));
    this.water.visible = false;
    this.water.frustumCulled = false;
    this.scene.add(this.water);
    this.nozzle = V(0, 2, 0);
    this.waterOn = false;
    for (let i = 0; i < N; i++) this._resetDrop(i, true);

    // 샤워기
    const shower = (this.shower = new THREE.Group());
    const sHead = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.05, 20), mat("#dfe8ef", { metalness: 0.6, roughness: 0.25 }));
    const sHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.35, 12), mat("#dfe8ef", { metalness: 0.6, roughness: 0.25 }));
    sHandle.rotation.z = 1.1;
    sHandle.position.set(0.17, 0.09, 0);
    shower.add(sHead, sHandle);
    shower.visible = false;
    this.scene.add(shower);
  }

  _resetDrop(i, randomY) {
    const p = this.waterPos, v = this.waterVel;
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.07;
    p[i * 3] = this.nozzle.x + Math.cos(a) * r;
    p[i * 3 + 1] = this.nozzle.y - (randomY ? Math.random() * 0.6 : 0);
    p[i * 3 + 2] = this.nozzle.z + Math.sin(a) * r;
    v[i * 3] = Math.cos(a) * r * 1.5;
    v[i * 3 + 1] = -1.6 - Math.random() * 0.6;
    v[i * 3 + 2] = Math.sin(a) * r * 1.5;
  }

  /* ---------------- 헬퍼 (스텝에서 사용) ---------------- */
  // 머리 표면 위의 점 (얼굴 앞쪽)
  face(x, y, lift = 0) {
    const r = HEAD_R + lift;
    const z = Math.sqrt(Math.max(0.0001, r * r - x * x - y * y));
    return V(x, y, z);
  }
  // 두피 위의 점: a=정수리에서 이마 쪽(+)/뒤통수 쪽(-) 각도, b=좌우(+오른쪽) 각도
  scalp(a, b, lift = 0.04) {
    const d = V(Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b), Math.sin(a));
    return d.multiplyScalar(HEAD_R + lift);
  }
  // obj 의 원점을 tip 에 두고 +Z 가 dir 방향을 보도록 (머리 좌표)
  aim(obj, tip, dir, roll = 0) {
    obj.position.copy(tip);
    const look = this.head.localToWorld(tip.clone().add(dir));
    obj.updateMatrixWorld();
    obj.up.copy(V(0, 1, 0).applyQuaternion(this.head.getWorldQuaternion(new THREE.Quaternion())));
    obj.lookAt(look);
    if (roll) obj.rotateZ(roll);
  }
  // 손으로 도구 쥐기: 도구 팁에서 dir 반대로 grip 만큼
  holdTool(hand, tip, dir, grip = 0.24, roll = 0) {
    const d = dir.clone().normalize();
    this.aim(hand, tip.clone().addScaledVector(d, -grip), d, roll);
  }

  setFoam(mesh, amount, opacity = 0.92) {
    const pts = mesh.userData.points;
    const n = Math.floor(pts.length * Math.min(1, Math.max(0, amount)));
    mesh.count = n;
    mesh.material.opacity = opacity;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const it = pts[i];
      const grow = Math.min(1, amount * pts.length / (i + 1) * 0.6);
      const s = it.s * (0.5 + 0.5 * grow) * (1 + 0.06 * Math.sin(this.time * 2 + i));
      m4.compose(it.p, q, V(s, s, s));
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  setPose(name) {
    this.poseGoal = new THREE.Quaternion().setFromEuler(POSES[name]);
    this.pose = name;
    this.basin.visible = name === "wash";
    this.pillow.visible = name !== "wash";
  }

  // focus: 머리 좌표의 점, offset: 월드 기준 카메라 오프셋
  setCamera(focus, offset) {
    this._camFocus = focus.clone();
    this._camOffset = offset.clone();
  }

  setWater(on, nozzleWorld) {
    this.waterOn = on;
    this.water.visible = on;
    this.shower.visible = on;
    if (nozzleWorld) this.nozzle.copy(nozzleWorld);
    this.shower.position.copy(this.nozzle).add(V(0, 0.03, 0));
  }

  hideAllProps() {
    Object.values(this.tools).forEach((t) => (t.visible = false));
    this.setWater(false);
    this.faceTowel.visible = false;
    this.hairTowel.visible = false;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 52 : 38;
    this.camera.updateProjectionMatrix();
  }

  update(dt, t) {
    this.time = t;
    // 포즈 부드럽게 전환
    if (this.poseGoal) this.root.quaternion.slerp(this.poseGoal, 1 - Math.pow(0.08, dt));
    // 숨쉬기
    const breath = Math.sin(t * 1.1);
    this.torso.scale.set(1.35 + breath * 0.012, 1, 0.75 + breath * 0.02);
    this.blanket.scale.z = 0.42 + breath * 0.012;
    this.root.updateMatrixWorld(true);

    // 카메라
    if (this._camFocus) {
      const fw = this.head.localToWorld(this._camFocus.clone());
      const drift = V(Math.sin(t * 0.13) * 0.05, Math.sin(t * 0.17) * 0.03, Math.cos(t * 0.11) * 0.05);
      this.camGoalTarget.copy(fw);
      this.camGoalPos.copy(fw).add(this._camOffset).add(drift);
    }
    const k = 1 - Math.pow(0.25, dt);
    this.camera.position.lerp(this.camGoalPos, k);
    this.camTarget.lerp(this.camGoalTarget, k);
    this.camera.lookAt(this.camTarget);

    // 촛불 흔들림
    this.candle.intensity = 0.55 + Math.sin(t * 13) * 0.05 + Math.random() * 0.06;
    this.flame.scale.y = 1.7 + Math.sin(t * 17) * 0.2;

    // 물줄기
    if (this.waterOn) {
      const p = this.waterPos, v = this.waterVel;
      const headW = this.head.getWorldPosition(V());
      for (let i = 0; i < p.length / 3; i++) {
        v[i * 3 + 1] -= 4 * dt;
        p[i * 3] += v[i * 3] * dt;
        p[i * 3 + 1] += v[i * 3 + 1] * dt;
        p[i * 3 + 2] += v[i * 3 + 2] * dt;
        const dx = p[i * 3] - headW.x, dy = p[i * 3 + 1] - headW.y, dz = p[i * 3 + 2] - headW.z;
        if (dx * dx + dy * dy + dz * dz < (HEAD_R + 0.06) ** 2 || p[i * 3 + 1] < 0.4) this._resetDrop(i, false);
      }
      this.water.geometry.attributes.position.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

export { THREE, V };
