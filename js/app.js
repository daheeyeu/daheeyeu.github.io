/* 뽀득뽀득 뷰티샵 — 화면 로직 */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const won = (n) => n.toLocaleString("ko-KR") + "원";

  const db = {
    get(k, d) {
      try {
        const v = localStorage.getItem("bb_" + k);
        return v ? JSON.parse(v) : d;
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem("bb_" + k, JSON.stringify(v));
      } catch {}
    },
  };

  const PRODUCT = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const ROOM = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
  const CATEGORIES = [...new Set(ROOMS.map((r) => r.category))];
  const catOf = (p) => ROOM[p.room].category;
  const linkOf = (p) => p.link || STORES[p.store].search(p.query || p.name);

  // 방 → 수면 ASMR 코스
  const SLEEP_COURSE = { shave: "skin", wax: "skin", massage: "skin", pack: "skin", cleanse: "skin", ear: "ear", headspa: "hair", snack: "all" };

  const FURNITURE = {
    shave: ["💈", "🪞"],
    wax: ["🔥", "🍯"],
    ear: ["🕯️", "🛋️"],
    massage: ["🎋", "🕯️"],
    pack: ["🌸", "🥣"],
    cleanse: ["🚰", "🫧"],
    headspa: ["🛁", "🚿"],
    snack: ["🍵", "🍓"],
  };

  const state = {
    cart: db.get("cart", {}),
    stats: db.get("stats", { coins: 500, happy: 60, guests: 0, tried: {} }),
    posts: db.get("posts", null) || SEED_POSTS.map((p, i) => ({ ...p, created: Date.now() - (i + 1) * 3600e3 })),
    voted: db.get("voted", {}),
    myReviews: db.get("reviews", {}),
    tab: "room",
    view: { type: "room", id: "shave" },
    cartGroup: db.get("cartGroup", "category"),
    boardSort: "votes",
    open: new Set(),
    busy: {},
    customers: {},
  };

  const save = () => {
    db.set("cart", state.cart);
    db.set("stats", state.stats);
    db.set("posts", state.posts);
    db.set("voted", state.voted);
    db.set("reviews", state.myReviews);
    db.set("cartGroup", state.cartGroup);
  };

  /* ---------------- 공통 ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.innerHTML = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function ticker(msg) {
    const el = $("#ticker");
    el.textContent = msg;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }

  function renderStats() {
    const s = state.stats;
    $("#st-coins").textContent = s.coins.toLocaleString();
    $("#st-happy").textContent = s.happy;
    $("#st-guests").textContent = s.guests;
    $("#st-cart").textContent = Object.values(state.cart).reduce((a, b) => a + b, 0);
  }

  const reviewsOf = (p) => [...p.reviews, ...(state.myReviews[p.id] || [])];
  function avgStars(p) {
    const r = reviewsOf(p);
    if (!r.length) return 0;
    return r.reduce((a, x) => a + x.stars, 0) / r.length;
  }
  const starStr = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
  const storeBadge = (key) => `<span class="badge store-${key}">${STORES[key].label}</span>`;

  function randomCustomer(except) {
    const pool = CUSTOMER_TYPES.filter((c) => c.id !== except);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ---------------- 지도 ---------------- */
  function renderMap() {
    const cells = ROOMS.map((r) => {
      const c = (state.customers[r.id] ||= randomCustomer());
      const [f1, f2] = FURNITURE[r.id];
      return `
      <button class="cell room ${r.floor}" data-room="${r.id}" aria-label="${r.name} 들어가기">
        <span class="sign">${r.icon} ${r.name}</span>
        <span class="deco d1">${f1}</span><span class="deco d2">${f2}</span>
        <span class="bed"><img class="customer px" src="${spriteURL(c.id)}" alt="${c.name}" /></span>
        <img class="staff px" src="${spriteURL("staff")}" alt="직원" />
        <span class="bubbles"></span>
        <span class="progress"><span></span></span>
      </button>`;
    });

    const storeCell = (key) => {
      const items = PRODUCTS.filter((p) => p.store === key);
      return `
      <button class="cell shop shop-${key}" data-store="${key}" aria-label="${STORES[key].label}관">
        <span class="sign">🛍️ ${STORES[key].label}관</span>
        <span class="shelf">${items.slice(0, 6).map((p) => `<i>${p.emoji}</i>`).join("")}</span>
        <span class="shelf">${items.slice(6, 12).map((p) => `<i>${p.emoji}</i>`).join("")}</span>
        <span class="shop-count">${items.length}개 상품</span>
      </button>`;
    };

    const top = [...state.posts].sort((a, b) => b.votes - a.votes)[0];
    const boardCell = `
      <button class="cell board-cell" data-board="1" aria-label="추천 투표 게시판">
        <span class="sign">🗳️ 추천 게시판</span>
        <span class="cork">
          <span class="note n1">👑 ${top ? esc(top.title).slice(0, 14) : "첫 추천을 남겨요"}</span>
          <span class="note n2">👍 ${top ? top.votes : 0}표</span>
        </span>
      </button>`;

    $("#map").innerHTML = [...cells, storeCell("oliveyoung"), storeCell("daiso"), storeCell("coupang"), boardCell].join("");
    markActiveCell();
  }

  function markActiveCell() {
    $$("#map .cell").forEach((el) => el.classList.remove("active"));
    if (state.tab === "board") $("#map [data-board]")?.classList.add("active");
    else if (state.tab === "room") {
      const sel = state.view.type === "room" ? `[data-room="${state.view.id}"]` : `[data-store="${state.view.id}"]`;
      $("#map " + sel)?.classList.add("active");
    }
  }

  $("#map").addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    if (cell.dataset.room) {
      state.view = { type: "room", id: cell.dataset.room };
      setTab("room");
    } else if (cell.dataset.store) {
      state.view = { type: "store", id: cell.dataset.store };
      setTab("room");
    } else if (cell.dataset.board) setTab("board");
    if (window.innerWidth < 900) $(".side").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------------- 써보기 (시술 애니메이션) ---------------- */
  function tryProduct(id) {
    const p = PRODUCT[id];
    const r = ROOM[p.room];
    if (state.busy[r.id]) {
      toast(`⏳ ${r.name}은(는) 지금 케어 중이에요!`);
      return;
    }
    const cell = $(`#map [data-room="${r.id}"]`);
    if (!cell) return;
    state.busy[r.id] = true;
    const DURATION = 3200;

    if (window.innerWidth < 900) cell.scrollIntoView({ behavior: "smooth", block: "center" });
    cell.classList.add("working");
    cell.style.setProperty("--dur", DURATION + "ms");
    const bubbles = $(".bubbles", cell);
    bubbles.innerHTML = `<span class="tool">${p.emoji}</span>`;
    ASMR.play(r.sound, DURATION / 1000);
    ticker(`${r.icon} ${r.name}: ${r.action}`);

    let i = 0;
    const iv = setInterval(() => {
      const b = document.createElement("span");
      b.className = "pop";
      b.textContent = r.bubbles[i++ % r.bubbles.length];
      b.style.left = 20 + Math.random() * 55 + "%";
      bubbles.appendChild(b);
      setTimeout(() => b.remove(), 1200);
    }, 450);

    setTimeout(() => {
      clearInterval(iv);
      cell.classList.remove("working");
      bubbles.innerHTML = "";
      const cust = state.customers[r.id];
      const first = !state.stats.tried[id];
      const gain = 20 + Math.round(p.price / 500);
      state.stats.coins += gain;
      state.stats.happy = Math.min(100, state.stats.happy + (first ? 4 : 1));
      state.stats.guests += 1;
      state.stats.tried[id] = true;
      save();
      renderStats();
      ASMR.coin();
      const quotes = ["너무 시원해요~", "또 올게요!", "잠들 뻔했어요…", "피부가 뽀득뽀득!", "대리만족 완료!", "소리 미쳤다…"];
      toast(`${cust.name}: “${quotes[Math.floor(Math.random() * quotes.length)]}” <b>+${gain}🪙</b>`);
      ticker(`✨ ${cust.name}이(가) ${p.name}(으)로 케어 받고 만족했어요! (+${gain} 코인)`);

      // 손님 교체
      const img = $(".customer", cell);
      img.classList.add("leave");
      setTimeout(() => {
        const next = randomCustomer(cust.id);
        state.customers[r.id] = next;
        img.src = spriteURL(next.id);
        img.alt = next.name;
        img.classList.remove("leave");
        img.classList.add("arrive");
        setTimeout(() => img.classList.remove("arrive"), 500);
        state.busy[r.id] = false;
      }, 450);
      if (state.tab === "room") renderPanel();
    }, DURATION);
  }

  /* ---------------- 장바구니 ---------------- */
  function addCart(id, n = 1) {
    const q = (state.cart[id] || 0) + n;
    if (q <= 0) delete state.cart[id];
    else state.cart[id] = q;
    save();
    renderStats();
    if (n > 0) {
      toast(`🛒 <b>${esc(PRODUCT[id].name)}</b> 담았어요!`);
      const btn = $("#btn-cart-top");
      btn.classList.remove("bump");
      void btn.offsetWidth;
      btn.classList.add("bump");
    }
  }

  /* ---------------- 패널 ---------------- */
  function setTab(tab) {
    state.tab = tab;
    $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === tab));
    renderPanel();
    markActiveCell();
  }

  function productCard(p, { showRoom = false } = {}) {
    const isOpen = state.open.has(p.id);
    const avg = avgStars(p);
    const reviews = reviewsOf(p);
    const tried = state.stats.tried[p.id];
    const inCart = state.cart[p.id];
    return `
    <article class="card ${isOpen ? "open" : ""}" data-id="${p.id}">
      <div class="card-top">
        <div class="p-emoji">${p.emoji}</div>
        <div class="p-info">
          <h4>${esc(p.name)} ${tried ? '<span class="tried">써봄</span>' : ""}</h4>
          <div class="meta">
            ${storeBadge(p.store)}
            ${showRoom ? `<span class="badge cat">${ROOM[p.room].icon} ${esc(ROOM[p.room].name)}</span>` : ""}
            <span class="price">${won(p.price)}</span>
          </div>
          <div class="stars" title="평점 ${avg.toFixed(1)}">${starStr(avg)} <small>${avg.toFixed(1)} (${reviews.length})</small></div>
        </div>
      </div>
      <div class="card-actions">
        ${showRoom ? "" : `<button class="btn btn-try" data-act="try">✨ 써보기</button>`}
        <button class="btn btn-cart" data-act="cart">🛒 담기${inCart ? ` <small>(${inCart})</small>` : ""}</button>
        <button class="btn btn-ghost" data-act="detail">${isOpen ? "▲ 접기" : "📋 성분·리뷰"}</button>
        <a class="btn btn-buy" href="${esc(linkOf(p))}" target="_blank" rel="noopener sponsored">구매 ↗</a>
      </div>
      ${isOpen ? detailHTML(p, reviews) : ""}
    </article>`;
  }

  function detailHTML(p, reviews) {
    return `
      <div class="detail">
        <dl>
          <dt>🧵 재질/제형</dt><dd>${esc(p.material)}</dd>
          <dt>🧪 성분</dt><dd class="chips">${p.ingredients.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</dd>
          <dt>💡 사용 팁</dt><dd>${esc(p.tip)}</dd>
        </dl>
        <h5>💬 리뷰 ${reviews.length}개</h5>
        <ul class="reviews">
          ${reviews
            .map(
              (rv) => `<li><b>${esc(rv.user)}</b> <span class="stars">${starStr(rv.stars)}</span>${rv.mine ? ' <span class="mine">내 리뷰</span>' : ""}<p>${esc(rv.text)}</p></li>`
            )
            .join("")}
        </ul>
        <form class="review-form" data-id="${p.id}">
          <select name="stars" aria-label="별점">
            ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}
          </select>
          <input name="user" maxlength="10" placeholder="닉네임" aria-label="닉네임" />
          <input name="text" maxlength="120" required placeholder="써보니 어땠나요?" aria-label="리뷰 내용" />
          <button class="btn btn-try">등록</button>
        </form>
      </div>`;
  }

  function roomView() {
    const v = state.view;
    if (v.type === "store") {
      const s = STORES[v.id];
      const items = PRODUCTS.filter((p) => p.store === v.id);
      const groups = CATEGORIES.map((cat) => [cat, items.filter((p) => catOf(p) === cat)]).filter(([, a]) => a.length);
      return `
        <div class="panel-head store-head" style="--c:${s.color}">
          <h2>🛍️ ${s.label}관</h2>
          <p>${s.label}에서 살 수 있는 제품만 모았어요. 누르면 바로 구매 페이지로!</p>
          <a class="btn btn-buy wide" href="${s.home}" target="_blank" rel="noopener">${s.label} 매장 바로가기 ↗</a>
        </div>
        ${groups.map(([cat, arr]) => `<h3 class="group-title">${esc(cat)} <small>${arr.length}</small></h3>${arr.map((p) => productCard(p, { showRoom: true })).join("")}`).join("")}`;
    }
    const r = ROOM[v.id];
    const items = PRODUCTS.filter((p) => p.room === r.id);
    const c = state.customers[r.id];
    return `
      <div class="room-switch">${ROOMS.map((x) => `<button class="mini ${x.id === r.id ? "on" : ""}" data-goroom="${x.id}" title="${x.name}">${x.icon}</button>`).join("")}</div>
      <div class="panel-head">
        <h2>${r.icon} ${r.name}</h2>
        <p>${esc(r.desc)}</p>
        <p class="now">${c ? `<img class="px" src="${spriteURL(c.id)}" alt="" /> 지금 <b>${c.name}</b>이(가) 기다리고 있어요` : ""}</p>
        <a class="btn btn-try wide sleep-btn" href="sleep.html?course=${SLEEP_COURSE[r.id] || "all"}">🌙 3D 캐릭터로 ASMR 보면서 잠들기</a>
      </div>
      ${items.map((p) => productCard(p)).join("")}`;
  }

  function cartView() {
    const ids = Object.keys(state.cart).filter((id) => PRODUCT[id]);
    if (!ids.length)
      return `
        <div class="empty">
          <p class="big">🛒</p>
          <p>장바구니가 비어 있어요.<br/>방에 들어가서 마음에 드는 제품을 <b>담기</b> 해 보세요!</p>
          <button class="btn btn-try" data-gotab="room">방 둘러보기</button>
        </div>`;

    const byStore = state.cartGroup === "store";
    const keys = byStore ? Object.keys(STORES) : CATEGORIES;
    const keyOf = (p) => (byStore ? p.store : catOf(p));
    let total = 0;
    const groups = keys
      .map((k) => {
        const arr = ids.map((id) => PRODUCT[id]).filter((p) => keyOf(p) === k);
        if (!arr.length) return "";
        const sub = arr.reduce((a, p) => a + p.price * state.cart[p.id], 0);
        total += sub;
        const head = byStore
          ? `<h3 class="group-title store-line" style="--c:${STORES[k].color}">${STORES[k].label} <small>${won(sub)}</small>
              <a class="btn btn-buy sm" href="${STORES[k].home}" target="_blank" rel="noopener">${STORES[k].label} 가기 ↗</a></h3>`
          : `<h3 class="group-title">${esc(k)} <small>${won(sub)}</small></h3>`;
        return (
          head +
          `<ul class="cart-list">${arr
            .map(
              (p) => `
            <li data-id="${p.id}">
              <span class="p-emoji sm">${p.emoji}</span>
              <span class="ci-name">${esc(p.name)}<br/>${storeBadge(p.store)} <small>${won(p.price)}</small></span>
              <span class="qty">
                <button class="q" data-q="-1" aria-label="빼기">−</button><b>${state.cart[p.id]}</b><button class="q" data-q="1" aria-label="더하기">+</button>
              </span>
              <a class="btn btn-buy sm" href="${esc(linkOf(p))}" target="_blank" rel="noopener sponsored">구매↗</a>
            </li>`
            )
            .join("")}</ul>`
        );
      })
      .join("");

    return `
      <div class="panel-head">
        <h2>🛒 내 장바구니</h2>
        <p>나중에 살 때 이 목록 보면서 한 번에 사요! 스토어별로 보면 매장마다 바로 갈 수 있어요.</p>
        <div class="seg">
          <button class="${!byStore ? "on" : ""}" data-group="category">📦 카테고리별</button>
          <button class="${byStore ? "on" : ""}" data-group="store">🏪 스토어별</button>
        </div>
      </div>
      ${groups}
      <div class="cart-total">
        <span>예상 합계</span><b>${won(total)}</b>
      </div>
      <div class="row-btns">
        <button class="btn btn-ghost" data-act="copy">📋 목록 복사</button>
        <button class="btn btn-ghost" data-act="clear">🗑️ 비우기</button>
      </div>`;
  }

  function boardView() {
    const posts = [...state.posts].sort((a, b) => (state.boardSort === "votes" ? b.votes - a.votes : b.created - a.created));
    const top = [...state.posts].sort((a, b) => b.votes - a.votes).slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];
    return `
      <div class="panel-head">
        <h2>🗳️ 고객 추천 투표</h2>
        <p>써보고 좋았던 제품을 추천하고, 다른 손님 추천에 👍 투표해 주세요!</p>
      </div>
      <div class="hall">
        <h3>🏆 명예의 전당</h3>
        <ol>${top
          .map((t, i) => {
            const p = PRODUCT[t.productId];
            return `<li><span>${medals[i]}</span> ${p ? p.emoji : "✨"} <b>${esc(p ? p.name : t.title)}</b> <small>${t.votes}표</small></li>`;
          })
          .join("")}</ol>
      </div>
      <form class="post-form" id="post-form">
        <h3>✍️ 추천 글 쓰기</h3>
        <select name="productId" required aria-label="추천할 제품">
          <option value="">추천할 제품 선택</option>
          ${ROOMS.map((r) => `<optgroup label="${r.icon} ${r.name}">${PRODUCTS.filter((p) => p.room === r.id).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</optgroup>`).join("")}
        </select>
        <input name="title" maxlength="30" required placeholder="한 줄 추천 (예: 이거 소리 미쳤어요)" aria-label="제목" />
        <textarea name="body" maxlength="200" rows="2" placeholder="왜 좋았는지 알려 주세요" aria-label="내용"></textarea>
        <div class="row">
          <input name="author" maxlength="10" placeholder="닉네임" aria-label="닉네임" />
          <button class="btn btn-try">추천 올리기</button>
        </div>
      </form>
      <div class="seg">
        <button class="${state.boardSort === "votes" ? "on" : ""}" data-sort="votes">🔥 인기순</button>
        <button class="${state.boardSort === "new" ? "on" : ""}" data-sort="new">🆕 최신순</button>
      </div>
      <ul class="posts">
        ${posts
          .map((t) => {
            const p = PRODUCT[t.productId];
            const voted = state.voted[t.id];
            return `
          <li class="post" data-post="${t.id}">
            <button class="vote ${voted ? "on" : ""}" data-act="vote" aria-label="추천 투표">👍<b>${t.votes}</b></button>
            <div class="post-body">
              <h4>${esc(t.title)}</h4>
              ${t.body ? `<p>${esc(t.body)}</p>` : ""}
              <div class="post-meta">
                ${p ? `<span class="badge cat">${p.emoji} ${esc(p.name)}</span> ${storeBadge(p.store)}` : ""}
                <small>by ${esc(t.author || "익명")}</small>
              </div>
              ${
                p
                  ? `<div class="row-btns"><button class="btn btn-cart sm" data-act="cart" data-id="${p.id}">🛒 담기</button><a class="btn btn-buy sm" href="${esc(linkOf(p))}" target="_blank" rel="noopener sponsored">구매 ↗</a>${t.mine ? `<button class="btn btn-ghost sm" data-act="delpost">삭제</button>` : ""}</div>`
                  : ""
              }
            </div>
          </li>`;
          })
          .join("")}
      </ul>
      <p class="small foot-note">※ 투표·글은 지금 이 브라우저에 저장돼요.</p>`;
  }

  function renderPanel() {
    const panel = $("#panel");
    panel.innerHTML = state.tab === "cart" ? cartView() : state.tab === "board" ? boardView() : roomView();
  }

  /* ---------------- 패널 이벤트 ---------------- */
  $("#panel").addEventListener("click", async (e) => {
    const t = e.target.closest("button, [data-act]");
    if (!t || t.tagName === "A") return;

    if (t.dataset.goroom) {
      state.view = { type: "room", id: t.dataset.goroom };
      renderPanel();
      markActiveCell();
      return;
    }
    if (t.dataset.gotab) return setTab(t.dataset.gotab);
    if (t.dataset.group) {
      state.cartGroup = t.dataset.group;
      save();
      return renderPanel();
    }
    if (t.dataset.sort) {
      state.boardSort = t.dataset.sort;
      return renderPanel();
    }

    const card = t.closest(".card");
    const li = t.closest(".cart-list li");
    const post = t.closest(".post");
    const act = t.dataset.act;

    if (card) {
      const id = card.dataset.id;
      if (act === "try") return tryProduct(id);
      if (act === "cart") {
        addCart(id);
        return renderPanel();
      }
      if (act === "detail") {
        state.open.has(id) ? state.open.delete(id) : state.open.add(id);
        return renderPanel();
      }
    }
    if (li && t.dataset.q) {
      addCart(li.dataset.id, Number(t.dataset.q));
      return renderPanel();
    }
    if (act === "copy") {
      const lines = Object.entries(state.cart)
        .filter(([id]) => PRODUCT[id])
        .map(([id, q]) => {
          const p = PRODUCT[id];
          return `- [${STORES[p.store].label}] ${p.name} x${q} (${won(p.price * q)}) ${linkOf(p)}`;
        });
      const text = `🛒 ${SITE.name} 장바구니\n` + lines.join("\n");
      try {
        await navigator.clipboard.writeText(text);
        toast("📋 장바구니 목록을 복사했어요!");
      } catch {
        prompt("아래 내용을 복사하세요", text);
      }
      return;
    }
    if (act === "clear") {
      if (confirm("장바구니를 비울까요?")) {
        state.cart = {};
        save();
        renderStats();
        renderPanel();
      }
      return;
    }
    if (post) {
      const pid = post.dataset.post;
      const item = state.posts.find((x) => x.id === pid);
      if (act === "vote" && item) {
        if (state.voted[pid]) {
          delete state.voted[pid];
          item.votes -= 1;
        } else {
          state.voted[pid] = true;
          item.votes += 1;
          ASMR.coin();
        }
        save();
        renderPanel();
        renderMap();
        return;
      }
      if (act === "cart") {
        addCart(t.dataset.id);
        return;
      }
      if (act === "delpost" && confirm("이 추천 글을 삭제할까요?")) {
        state.posts = state.posts.filter((x) => x.id !== pid);
        save();
        renderPanel();
        renderMap();
      }
    }
  });

  $("#panel").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData(f);
    if (f.classList.contains("review-form")) {
      const id = f.dataset.id;
      const text = String(fd.get("text") || "").trim();
      if (!text) return;
      (state.myReviews[id] ||= []).push({
        user: String(fd.get("user") || "").trim() || "나",
        stars: Number(fd.get("stars")) || 5,
        text,
        mine: true,
      });
      save();
      toast("💬 리뷰가 등록됐어요!");
      return renderPanel();
    }
    if (f.id === "post-form") {
      const productId = fd.get("productId");
      const title = String(fd.get("title") || "").trim();
      if (!productId || !title) return;
      const newId = "u-" + Date.now();
      state.posts.push({
        id: newId,
        productId,
        title,
        body: String(fd.get("body") || "").trim(),
        author: String(fd.get("author") || "").trim() || "익명",
        votes: 1,
        created: Date.now(),
        mine: true,
      });
      state.voted[newId] = true;
      state.boardSort = "new";
      save();
      toast("🗳️ 추천 글이 올라갔어요!");
      renderPanel();
      renderMap();
    }
  });

  /* ---------------- 상단 버튼 ---------------- */
  $$(".tab").forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));
  $("#btn-cart-top").addEventListener("click", () => {
    setTab("cart");
    if (window.innerWidth < 900) $(".side").scrollIntoView({ behavior: "smooth" });
  });
  $("#btn-sound").addEventListener("click", () => {
    const on = ASMR.toggle();
    $("#sound-icon").textContent = on ? "🔊" : "🔇";
    toast(on ? "🔊 ASMR 소리 켜짐" : "🔇 소리 꺼짐");
  });

  /* ---------------- 시작 ---------------- */
  $("#disclosure").textContent = "📢 " + SITE.disclosure;
  renderMap();
  renderStats();
  setTab("room");

  const tips = [
    "🫧 방을 눌러 들어가서 ✨써보기 를 누르면 ASMR 케어가 시작돼요",
    "🛒 마음에 들면 담기! 장바구니에서 올리브영/다이소별로 볼 수 있어요",
    "🗳️ 추천 게시판에서 다른 손님들의 추천템을 확인해 보세요",
    "🍡 간식바에서는 케어 중에 간식을 쏙 넣어 줘요",
    "🚿 헤드스파는 대리만족 1등 코스!",
  ];
  let tipI = 0;
  setInterval(() => {
    if (Object.values(state.busy).some(Boolean)) return;
    ticker(tips[tipI++ % tips.length]);
  }, 7000);
})();
