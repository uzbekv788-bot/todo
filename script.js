(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const fmt = (n) => '$' + n.toFixed(2);
  const byId = (id) => GAMES.find((g) => g.id === Number(id));
  const cover = (id) => `covers/cover-${id}.jpg`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const platformText = (g) => (g.platform === 'PS4' ? 'PS4 · работает на PS5' : 'PS5');
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
  };
  const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  const state = { query: '', genre: 'Все', sort: 'popular', cart: loadCart(), featured: 0 };

  function loadCart() {
    try { return (JSON.parse(localStorage.getItem('pz-cart-v4')) || []).filter(byId); } catch { return []; }
  }
  function saveCart() {
    try { localStorage.setItem('pz-cart-v4', JSON.stringify(state.cart)); } catch {}
  }
  const total = () => state.cart.reduce((s, id) => s + byId(id).price, 0);

  // ================= Theme: light / dark =================
  const root = document.documentElement;
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : darkMQ.matches);
  const themeBtn = $('#themeToggle');
  function syncThemeButton() {
    const dark = isDark();
    themeBtn.setAttribute('aria-pressed', dark);
    themeBtn.setAttribute('aria-label', dark ? 'Тёмная тема включена. Переключить на светлую' : 'Светлая тема включена. Переключить на тёмную');
    themeBtn.querySelector('.theme-toggle__text').textContent = dark ? 'Тёмная тема' : 'Светлая тема';
  }
  themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('pz-theme', next); } catch {}
    syncThemeButton();
  });
  darkMQ.addEventListener('change', syncThemeButton);
  new MutationObserver(syncThemeButton).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  syncThemeButton();

  $('#factCount').textContent = GAMES.length;
  $('#factMin').textContent = fmt(Math.min(...GAMES.map((g) => g.price)));

  // ================= Block 1: featured =================
  const picks = $('.picks');
  picks.innerHTML = FEATURED.map((f, i) => {
    const g = byId(f.id);
    return `<button type="button" role="tab" class="pick" id="pick-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-pick="${i}">
      <span class="pick__year">${g.year}</span>
      <span class="pick__title">${esc(g.title)}</span>
      <span class="pick__price">${fmt(g.price)}</span>
    </button>`;
  }).join('');

  function showFeatured(i, focus) {
    state.featured = i;
    const f = FEATURED[i], g = byId(f.id);
    $('#heroCover').src = cover(g.id);
    $('#heroCover').alt = `Обложка ${g.title}`;
    $('#heroLabel').textContent = f.label;
    $('#heroTitle').textContent = g.title;
    $('#heroMeta').textContent = `${g.genre} · ${g.year} · ${g.dev} · ${platformText(g)}`;
    $('#heroLead').textContent = f.text;
    $('#heroPrice').textContent = fmt(g.price);
    $('#heroBuy').dataset.add = g.id;
    $('#heroMore').dataset.open = g.id;
    syncAddButtons();
    $$('.pick').forEach((b, k) => {
      b.setAttribute('aria-selected', k === i);
      b.tabIndex = k === i ? 0 : -1;
      if (k === i && focus) b.focus();
    });
  }
  picks.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) showFeatured(Number(b.dataset.pick));
  });
  picks.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    showFeatured((state.featured + d + FEATURED.length) % FEATURED.length, true);
  });

  // ================= Block 2: catalog =================
  const genreCounts = GAMES.reduce((m, g) => ((m[g.genre] = (m[g.genre] || 0) + 1), m), {});
  const genres = ['Все', ...Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a])];
  $('#genres').innerHTML = genres
    .map((g) => `<button type="button" class="genre" data-genre="${g}" aria-pressed="${g === state.genre}">${g} <span>${g === 'Все' ? GAMES.length : genreCounts[g]}</span></button>`)
    .join('');

  function setGenre(genre) {
    state.genre = genre;
    $$('.genre').forEach((c) => c.setAttribute('aria-pressed', c.dataset.genre === genre));
    render();
  }
  $('#genres').addEventListener('click', (e) => {
    const b = e.target.closest('[data-genre]');
    if (b) setGenre(b.dataset.genre);
  });
  $('#search').addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); render(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('#resetFilters').addEventListener('click', () => {
    $('#search').value = ''; state.query = '';
    setGenre('Все');
    $('#search').focus();
  });

  const sorters = {
    popular: (a, b) => b.popularity - a.popularity,
    new: (a, b) => b.year - a.year || b.popularity - a.popularity,
    'price-asc': (a, b) => a.price - b.price || b.popularity - a.popularity,
    'price-desc': (a, b) => b.price - a.price || b.popularity - a.popularity,
  };

  function card(g) {
    const inCart = state.cart.includes(g.id);
    return `
      <article class="card">
        <div class="card__top"><span>${g.genre}</span><span class="card__year">${g.year}</span></div>
        <button type="button" class="card__open" data-open="${g.id}" aria-label="${esc(g.title)}: сюжет и детали">
          <span class="card__cover"><img src="${cover(g.id)}" alt="" loading="lazy" decoding="async"></span>
          <span class="card__title">${esc(g.title)}</span>
        </button>
        <p class="card__meta">${g.dev}</p>
        <p class="card__platform">${g.tag ? `<span class="card__tag">${g.tag}</span>` : ''}${platformText(g)}</p>
        <div class="card__bottom">
          <span class="card__price">${fmt(g.price)}</span>
          <button type="button" class="btn btn--ink btn--sm" data-add="${g.id}" aria-pressed="${inCart}"
            aria-label="${inCart ? 'Убрать из корзины' : 'Добавить в корзину'}: ${esc(g.title)}">${inCart ? 'В корзине' : 'В корзину'}</button>
        </div>
      </article>`;
  }

  function render() {
    const list = GAMES
      .filter((g) => state.genre === 'Все' || g.genre === state.genre)
      .filter((g) => g.title.toLowerCase().includes(state.query))
      .sort(sorters[state.sort]);
    $('#grid').innerHTML = list.map(card).join('');
    $('#empty').hidden = list.length > 0;
    $('#resultCount').textContent = list.length;
    $('#resultCount').setAttribute('aria-label', `${list.length} ${plural(list.length, 'игра', 'игры', 'игр')}`);
    syncAddButtons();
  }

  // ================= Game dialog =================
  const dialog = $('#gameDialog');
  let dialogGame = null;
  function openGame(id) {
    const g = byId(id); dialogGame = g.id;
    $('#gameCover').src = cover(g.id);
    $('#gameCover').alt = `Обложка ${g.title}`;
    $('#gameMeta').textContent = `${g.genre} · ${g.year}`;
    $('#gameTitle').textContent = g.title;
    $('#gameDev').textContent = g.dev;
    $('#gamePlatform').textContent = g.platform === 'PS4' ? 'Версия для PS4, работает на PS5' : 'PS5';
    $('#gamePlot').textContent = g.plot;
    $('#gamePrice').textContent = fmt(g.price);
    $('#gameAdd').dataset.add = g.id;
    syncAddButtons();
    dialog.showModal();
  }
  $('#gameClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  // ================= Cart =================
  function syncAddButtons() {
    $$('[data-add]').forEach((b) => {
      const id = Number(b.dataset.add), inCart = state.cart.includes(id), g = byId(id);
      b.setAttribute('aria-pressed', inCart);
      if (b.closest('.card')) {
        b.textContent = inCart ? 'В корзине' : 'В корзину';
        b.setAttribute('aria-label', `${inCart ? 'Убрать из корзины' : 'Добавить в корзину'}: ${g.title}`);
      } else {
        b.textContent = inCart ? 'Перейти к оплате' : 'В корзину';
      }
    });
  }
  function refresh() { saveCart(); render(); renderOrder(); }
  function addToCart(id) {
    state.cart.push(id); refresh();
    toast(`«${byId(id).title}» в корзине`, 'К оплате', goCheckout);
  }
  function removeFromCart(id) {
    const idx = state.cart.indexOf(id);
    if (idx < 0) return;
    state.cart.splice(idx, 1); refresh();
    toast(`«${byId(id).title}» убрана`, 'Вернуть', () => { state.cart.splice(Math.min(idx, state.cart.length), 0, id); refresh(); });
  }
  function goCheckout() {
    if (dialog.open) dialog.close();
    $('#checkout').scrollIntoView({ behavior: smooth() });
    setTimeout(() => $('#email').focus({ preventScroll: true }), 400);
  }

  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) { openGame(open.dataset.open); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      const id = Number(add.dataset.add);
      if (!state.cart.includes(id)) addToCart(id);
      else if (add.closest('.card')) removeFromCart(id);
      else goCheckout();
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) removeFromCart(Number(rm.dataset.remove));
  });

  function renderOrder() {
    const items = state.cart.map(byId), n = items.length, t = total();
    $('#cartCount').textContent = n;
    $('#cartLink').setAttribute('aria-label', `Корзина: ${n} ${plural(n, 'игра', 'игры', 'игр')}, ${fmt(t)}`);
    $('#orderList').innerHTML = items.map((g) => `
      <li class="order__item">
        <img src="${cover(g.id)}" alt="">
        <div class="order__info"><strong>${esc(g.title)}</strong><span>${platformText(g)}</span></div>
        <span class="order__price">${fmt(g.price)}</span>
        <button type="button" class="order__remove" data-remove="${g.id}" aria-label="Убрать ${esc(g.title)}">Убрать</button>
      </li>`).join('');
    $('#orderEmpty').hidden = n > 0;
    $('#orderList').hidden = n === 0;
    $('#orderTotalRow').hidden = n === 0;
    $('#orderTotal').textContent = fmt(t);
    $('#checkoutTotalBig').textContent = fmt(t);
    $('#payBtn').textContent = n ? `Оплатить ${fmt(t)}` : 'Оплатить';
  }

  // ================= Payment form =================
  const form = $('#payForm');
  const digits = (s) => s.replace(/\D/g, '');
  function brandOf(num) {
    if (/^3[47]/.test(num)) return { name: 'American Express', lens: [15], cvc: 4, groups: [4, 6, 5] };
    if (/^220[0-4]/.test(num)) return { name: 'Мир', lens: [16, 17, 18, 19], cvc: 3 };
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(num)) return { name: 'Mastercard', lens: [16], cvc: 3 };
    if (/^4/.test(num)) return { name: 'Visa', lens: [13, 16, 19], cvc: 3 };
    return null;
  }
  function luhn(num) {
    let sum = 0, dbl = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let d = +num[i];
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return num.length > 0 && sum % 10 === 0;
  }
  function formatCard(num) {
    const b = brandOf(num);
    if (b && b.groups) {
      const out = []; let i = 0;
      for (const g of b.groups) { if (i >= num.length) break; out.push(num.slice(i, i + g)); i += g; }
      return out.join(' ');
    }
    return num.replace(/(.{4})/g, '$1 ').trim();
  }

  const cc = $('#ccNumber'), exp = $('#ccExp'), cvc = $('#ccCvc'), cname = $('#ccName');
  cc.addEventListener('input', () => {
    const b0 = brandOf(digits(cc.value));
    const num = digits(cc.value).slice(0, b0 ? Math.max(...b0.lens) : 19);
    cc.value = formatCard(num);
    const b = brandOf(num);
    $('#ccBrand').textContent = b ? b.name : '';
    $('#ccCvc-hint').textContent = b && b.cvc === 4 ? '4 цифры на лицевой стороне' : '3 цифры на обороте';
    if (cc.getAttribute('aria-invalid') === 'true') validate('ccNumber');
  });
  exp.addEventListener('input', (e) => {
    let d = digits(exp.value).slice(0, 4);
    if (d.length === 1 && +d > 1) d = '0' + d;
    exp.value = d.length > 2 || (d.length === 2 && e.inputType !== 'deleteContentBackward') ? d.slice(0, 2) + '/' + d.slice(2) : d;
    if (exp.getAttribute('aria-invalid') === 'true') validate('ccExp');
  });
  cvc.addEventListener('input', () => { cvc.value = digits(cvc.value).slice(0, 4); });
  cname.addEventListener('input', () => { cname.value = cname.value.toUpperCase(); });

  const rules = {
    email: () => {
      const v = $('#email').value.trim();
      if (!v) return 'Введите e-mail — на него придут ключи.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Проверьте адрес: нужен формат name@mail.ru.';
    },
    phone: () => {
      const v = digits($('#phone').value);
      if (v && (v.length < 10 || v.length > 15)) return 'В номере должно быть от 10 до 15 цифр. Поле можно оставить пустым.';
    },
    ccNumber: () => {
      const v = digits(cc.value);
      if (!v) return 'Введите номер карты.';
      const b = brandOf(v);
      if (!b) return 'Принимаем Visa, Mastercard, American Express и «Мир». Проверьте первые цифры.';
      if (!b.lens.includes(v.length)) return `Для ${b.name} нужно ${b.lens.join(' или ')} цифр, сейчас ${v.length}.`;
      if (!luhn(v)) return 'Номер введён с ошибкой: проверьте цифры.';
    },
    ccExp: () => {
      const m = exp.value.match(/^(\d{2})\/(\d{2})$/);
      if (!m) return 'Введите срок в формате ММ/ГГ, например 08/29.';
      const mm = +m[1], yy = 2000 + +m[2];
      if (mm < 1 || mm > 12) return 'Месяц должен быть от 01 до 12.';
      const now = new Date();
      if (yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1)) return 'Срок действия карты истёк.';
      if (yy > now.getFullYear() + 20) return 'Проверьте год: он слишком далёкий.';
    },
    ccCvc: () => {
      const b = brandOf(digits(cc.value)), need = b ? b.cvc : 3;
      if (cvc.value.length !== need) return `Введите ${need} цифры CVC.`;
    },
    ccName: () => {
      const v = cname.value.trim();
      if (!v) return 'Введите имя латиницей, как на карте.';
      if (!/^[A-Z][A-Z .'-]+$/.test(v)) return 'Только латинские буквы, как напечатано на карте.';
    },
    terms: () => { if (!$('#terms').checked) return 'Подтвердите согласие с условиями, чтобы продолжить.'; },
  };
  const usingCard = () => form.elements.method.value === 'card';
  const activeFields = () => ['email', 'phone', ...(usingCard() ? ['ccNumber', 'ccExp', 'ccCvc', 'ccName'] : []), 'terms'];

  function validate(id) {
    const msg = rules[id]() || '';
    const el = $('#' + id);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    el.closest('.input, .check')?.classList.toggle('is-error', !!msg);
    $('#' + id + '-err').textContent = msg;
    return !msg;
  }
  ['email', 'phone', 'ccNumber', 'ccExp', 'ccCvc', 'ccName'].forEach((id) => {
    $('#' + id).addEventListener('blur', () => { if ($('#' + id).value) validate(id); });
  });
  $('#terms').addEventListener('change', () => validate('terms'));

  form.addEventListener('change', (e) => {
    if (e.target.name !== 'method') return;
    $('#cardFields').hidden = !usingCard();
    $('#sbpInfo').hidden = usingCard();
  });

  $('#fillTest').addEventListener('click', () => {
    cc.value = '4242 4242 4242 4242'; cc.dispatchEvent(new Event('input'));
    const y = (new Date().getFullYear() + 3) % 100;
    exp.value = `12/${String(y).padStart(2, '0')}`;
    cvc.value = '123';
    cname.value = 'TEST CARDHOLDER';
    ['ccNumber', 'ccExp', 'ccCvc', 'ccName'].forEach(validate);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const status = $('#payStatus');
    if (!state.cart.length) {
      status.textContent = 'Корзина пуста: добавьте хотя бы одну игру из каталога.';
      status.className = 'pay__status is-error';
      return;
    }
    const bad = activeFields().filter((id) => !validate(id));
    if (bad.length) {
      status.textContent = `Исправьте ${bad.length} ${plural(bad.length, 'поле', 'поля', 'полей')}, отмеченных красным.`;
      status.className = 'pay__status is-error';
      $('#' + bad[0]).focus();
      return;
    }
    status.textContent = ''; status.className = 'pay__status';
    const btn = $('#payBtn');
    btn.disabled = true; btn.textContent = 'Проверяем оплату…';
    setTimeout(() => finish(), 1200);
  });

  function demoKey() {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join('');
    return `${part()}-${part()}-${part()}`;
  }
  function finish() {
    const items = state.cart.map(byId), t = total();
    const email = $('#email').value.trim();
    const num = digits(cc.value);
    const how = usingCard() ? `картой ${brandOf(num).name} •••• ${num.slice(-4)}` : 'через СБП';
    $('#doneText').textContent = `Оплачено ${fmt(t)} ${how}. Ключи отправлены на ${email}.`;
    $('#doneKeys').innerHTML = items.map((g) => `<li><span>${esc(g.title)}</span><code>${demoKey()}</code></li>`).join('');
    form.hidden = true; $('#done').hidden = false; $('#done').focus();
    state.cart = []; refresh();
    // card data is not kept anywhere
    [cc, exp, cvc, cname].forEach((el) => (el.value = ''));
    $('#ccBrand').textContent = '';
    $('#payBtn').disabled = false;
  }
  $('#newOrder').addEventListener('click', () => {
    $('#done').hidden = true; form.hidden = false; $('#terms').checked = false;
    $('#catalog').scrollIntoView({ behavior: smooth() });
  });

  // ================= Toast =================
  let toastTimer, toastFn = null;
  function toast(text, actionLabel, fn) {
    $('#toastText').textContent = text;
    toastFn = fn || null;
    $('#toastAction').hidden = !fn;
    $('#toastAction').textContent = actionLabel || '';
    $('#toast').classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#toast').classList.remove('is-visible'); toastFn = null; }, 5000);
  }
  $('#toastAction').addEventListener('click', () => {
    const fn = toastFn; toastFn = null;
    $('#toast').classList.remove('is-visible');
    if (fn) fn();
  });

  showFeatured(0);
  render();
  renderOrder();
})();
