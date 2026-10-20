(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const WHATSAPP = '556136332392';

  // Intro: quadros do vídeo desenhados num canvas conforme a rolagem
  const FRAMES = 120;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frameDir = innerWidth < 768 ? 'assets/intro-m/' : 'assets/intro/';
  const frames = new Array(FRAMES);
  let loadedCount = 0;
  const firstBatch = 24; // o loader espera estes quadros iniciais

  const loadFrame = i => new Promise(res => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { frames[i] = img; loadedCount++; res(); };
    img.onerror = res;
    img.src = frameDir + 'f' + String(i + 1).padStart(3, '0') + '.webp';
  });
  // Primeiro os quadros iniciais em ordem; o resto em paralelo, sem bloquear
  const introReady = (async () => {
    for (let i = 0; i < firstBatch; i += 6) {
      await Promise.all(Array.from({ length: 6 }, (_, k) => loadFrame(i + k)));
    }
  })();
  introReady.then(() => {
    for (let i = firstBatch; i < FRAMES; i++) loadFrame(i);
  });

  // Loader: contador ligado ao carregamento dos quadros iniciais
  document.body.classList.add('is-loading');
  const loader = $('#loader'), count = $('#loaderCount');
  const started = performance.now();
  let shown = 0;
  const tickLoader = () => {
    const real = Math.min(1, loadedCount / firstBatch) * 100;
    const minTime = Math.min(100, (performance.now() - started) / 12); // pelo menos ~1,2 s
    shown = Math.min(real, minTime);
    count.textContent = String(Math.floor(shown)).padStart(3, '0');
    if (shown >= 100) {
      setTimeout(() => {
        loader.classList.add('is-done');
        document.body.classList.remove('is-loading');
      }, 250);
    } else requestAnimationFrame(tickLoader);
  };
  requestAnimationFrame(tickLoader);

  const intro = $('#intro'), canvas = $('#introCanvas'), ctx = canvas.getContext('2d');
  const sticky = $('.intro__sticky'), bar = $('#introBar'), hint = $('#introHint');
  const layers = $$('.intro__layer');
  let current = 0, target = 0, lastDrawn = -1;

  const sizeCanvas = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    lastDrawn = -1;
  };
  // Desenha o quadro mais próximo já carregado, cobrindo o canvas (object-fit: cover)
  const draw = idx => {
    let i = idx;
    while (i > 0 && !frames[i]) i--;
    const img = frames[i];
    if (!img || i === lastDrawn) return;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.width, ch / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    lastDrawn = i;
  };

  // Opacidade de uma camada: entra em [a, b], fica, sai em [c, d]
  const band = (p, a, b, c, d) => p < a || p > d ? 0 : p < b ? (p - a) / (b - a) : p <= c ? 1 : 1 - (p - c) / (d - c);
  const progress = () => {
    const r = intro.getBoundingClientRect();
    const total = intro.offsetHeight - innerHeight;
    return Math.min(1, Math.max(0, -r.top / total));
  };

  const loop = () => {
    const p = progress();
    target = p * (FRAMES - 1);
    current += (target - current) * 0.18; // suaviza a rolagem
    if (Math.abs(target - current) < 0.01) current = target;
    draw(Math.round(current));

    // Camadas de texto
    const ops = [band(p, -1, 0, .12, .22), band(p, .28, .38, .55, .64), band(p, .72, .8, 1.1, 1.2)];
    layers.forEach((l, k) => {
      l.style.opacity = ops[k];
      l.style.transform = `translateY(${(1 - ops[k]) * 30}px)`;
      l.classList.toggle('is-live', ops[k] > .5);
    });
    // Zoom leve, escurecimento e "recorte" no final para emendar com o hero
    sticky.style.setProperty('--zoom', 1 + p * .08);
    sticky.style.setProperty('--tint', (.15 + band(p, .26, .36, .9, 1) * .2).toFixed(3));
    const end = Math.max(0, (p - .9) / .1);
    sticky.style.setProperty('--clip', (end * 18).toFixed(1) + 'px');
    sticky.style.setProperty('--radius', (end * 14).toFixed(1) + 'px');
    bar.style.transform = `scaleX(${p})`;
    hint.style.opacity = p > .04 ? 0 : 1;
    requestAnimationFrame(loop);
  };

  addEventListener('resize', sizeCanvas);
  sizeCanvas();
  introReady.then(() => {
    if (reduceMotion) { frames[FRAMES - 1] ? draw(FRAMES - 1) : draw(0); return; }
    requestAnimationFrame(loop);
  });
  if (reduceMotion) loadFrame(FRAMES - 1).then(() => { lastDrawn = -1; draw(FRAMES - 1); });

  // Relógio do cabeçalho
  const clock = $('#clock');
  const updateClock = () => {
    const t = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    clock.textContent = 'Brasília ' + t;
  };
  updateClock();
  setInterval(updateClock, 30000);
  $('#year').textContent = new Date().getFullYear();

  // Menu em tela cheia
  const menu = $('#menu'), menuBtn = $('#menuBtn');
  const setMenu = open => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', !open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.textContent = open ? 'Fechar' : 'Menu';
    syncHeader();
  };
  menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => e.key === 'Escape' && setMenu(false));

  // Cor do cabeçalho conforme a seção que está por baixo
  const header = $('#header');
  const lightZones = $$('section.light');
  function syncHeader() {
    const y = header.offsetHeight / 2;
    const open = menu.classList.contains('is-open');
    const onLight = !open && lightZones.some(s => {
      const r = s.getBoundingClientRect();
      return r.top <= y && r.bottom >= y;
    });
    header.classList.toggle('on-light', onLight);
    header.classList.toggle('scrolled', scrollY > 40 && !open);
  }
  addEventListener('scroll', syncHeader, { passive: true });
  syncHeader();

  // Reveal ao rolar
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: .15 });
  $$('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 70 + 'ms';
    io.observe(el);
  });

  // Marquees: duplica o conteúdo para o loop contínuo
  $$('.marquee__track').forEach(t => { t.innerHTML += t.innerHTML; });

  // Lista animada do card do hero (serviços da oficina)
  const log = $('#flowLog');
  const jobs = [
    'Cilindro hidráulico — recuperação', 'Eixo — embuchamento', 'Marca de gado — inox',
    'Concha para pá — fabricação', 'Mangueira hidráulica — prensagem', 'Peça em alumínio — solda TIG',
    'Guincho big bag — fabricação', 'Rosca helicoidal — montagem'
  ];
  let ji = 0;
  const pushJob = () => {
    const row = document.createElement('div');
    row.innerHTML = `<b>✓</b> ${jobs[ji++ % jobs.length]}`;
    log.prepend(row);
    while (log.children.length > 4) log.lastChild.remove();
  };
  pushJob();
  setInterval(pushJob, 1600);

  // Acordeões
  $$('.acc').forEach(acc => {
    $$('.acc__head', acc).forEach(head => head.addEventListener('click', () => {
      const item = head.parentElement, open = !item.classList.contains('is-open');
      if (acc.hasAttribute('data-single')) $$('.acc__item', acc).forEach(i => i.classList.remove('is-open'));
      item.classList.toggle('is-open', open);
    }));
  });

  // Slider missão / visão
  const slides = $$('.slide'), idx = $('#slideIdx');
  let si = 0, auto;
  const show = i => {
    si = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === si));
    idx.textContent = String(si + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
  };
  const restart = () => { clearInterval(auto); auto = setInterval(() => show(si + 1), 6000); };
  $$('.slider__nav .round').forEach(b => b.addEventListener('click', () => { show(si + +b.dataset.dir); restart(); }));
  restart();

  // Formulário: monta a mensagem e abre o WhatsApp
  const form = $('#form'), status = $('#formStatus');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    $$('[required]', form).forEach(f => {
      const bad = !f.value.trim();
      f.classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { status.textContent = 'Preencha os campos obrigatórios.'; return; }
    const d = Object.fromEntries(new FormData(form));
    const text = [
      `Olá, Torneagro! Sou ${d.nome.trim()}${d.cidade.trim() ? ', de ' + d.cidade.trim() : ''}.`,
      `Serviço: ${d.servico}`,
      d.msg.trim()
    ].join('\n');
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    status.textContent = 'Abrindo o WhatsApp…';
  });
})();
