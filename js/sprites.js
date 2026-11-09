/* 도트 캐릭터: 문자열 지도를 캔버스로 그려 이미지로 만든다 */
const PALETTE = {
  k: "#3a2230", // 외곽선
  w: "#fffaf4", // 흰색
  o: "#f5a142", // 주황(고양이)
  b: "#a8673a", // 갈색(곰)
  t: "#f1d2a2", // 베이지
  p: "#ff8fb1", // 분홍
  e: "#2a1620", // 눈
  s: "#ffd9bd", // 피부
  r: "#e5486a", // 입
  g: "#6cc48c", // 초록 앞치마
  m: "#8fd8f0", // 하늘
  y: "#ffd84a", // 노랑
};

const SPRITES = {
  cat: [
    ".k........k.",
    "kok......kok",
    "kook....kook",
    "koookkkkoook",
    "kooooooooook",
    "kooeooooeook",
    "kpoooeeooopk",
    "kooooooooook",
    ".kooooooook.",
    "..kkkkkkkk..",
  ],
  bunny: [
    "..kk....kk..",
    ".kwk....kwk.",
    ".kpk....kpk.",
    ".kwk....kwk.",
    "..kwkkkkwk..",
    ".kwwwwwwwwk.",
    "kwwewwwwewwk",
    "kpwwweewwwpk",
    "kwwwwwwwwwwk",
    ".kwwwwwwwwk.",
    "..kkkkkkkk..",
  ],
  bear: [
    ".kk......kk.",
    "kbbk....kbbk",
    "kbbkkkkkkbbk",
    ".kbbbbbbbbk.",
    "kbbbbbbbbbbk",
    "kbbebbbbebbk",
    "kbbbttttbbbk",
    "kpbtteettbpk",
    ".kbbttttbbk.",
    "..kkkkkkkk..",
  ],
  panda: [
    ".kk......kk.",
    "kkkk....kkkk",
    "kkkkkkkkkkkk",
    ".kwwwwwwwwk.",
    "kwkkwwwwkkwk",
    "kwkwkwwkwkwk",
    "kwwwwkkwwwwk",
    "kpwwwwwwwwpk",
    ".kwwwwwwwwk.",
    "..kkkkkkkk..",
  ],
  chick: [
    ".....kk.....",
    "....kyyk....",
    "..kkyyyykk..",
    ".kyyyyyyyyk.",
    "kyyeyyyyeyyk",
    "kpyyyoooyypk",
    "kyyyyyoyyyyk",
    ".kyyyyyyyyk.",
    "..kkkkkkkk..",
  ],
  staff: [
    "...kkkkkk...",
    "..kpppppppk.",
    ".kppppppppk.",
    ".kpssssssspk",
    ".kssesssessk",
    ".kssssrsssk.",
    "..kssssssk..",
    ".kwwwwwwwwk.",
    "kswggggggwsk",
    "kswggggggwsk",
    ".kwggggggwk.",
    "..kggggggk..",
    "..kbbkkbbk..",
    "..kkk..kkk..",
  ],
};

const CUSTOMER_TYPES = [
  { id: "cat", name: "냥냥 손님" },
  { id: "bunny", name: "토끼 손님" },
  { id: "bear", name: "곰돌 손님" },
  { id: "panda", name: "판다 손님" },
  { id: "chick", name: "삐약 손님" },
];

const _spriteCache = {};
function spriteURL(name) {
  if (_spriteCache[name]) return _spriteCache[name];
  const rows = SPRITES[name];
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = rows.length;
  const ctx = c.getContext("2d");
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "." || !PALETTE[ch]) return;
      ctx.fillStyle = PALETTE[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return (_spriteCache[name] = c.toDataURL());
}
