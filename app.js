/* =============================================
   SEQUATOR — app.js
   Starfield, tabs, scroll animations, nav effects
   ============================================= */

// ---- STARFIELD CANVAS ----
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');

  let W, H, stars = [], shootingStars = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function randomBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeStar() {
    return {
      x: randomBetween(0, W),
      y: randomBetween(0, H),
      r: randomBetween(0.3, 1.6),
      alpha: randomBetween(0.2, 1),
      speed: randomBetween(0.0002, 0.001),
      phase: randomBetween(0, Math.PI * 2),
      color: Math.random() > 0.9
        ? (Math.random() > 0.5 ? '#a0c8ff' : '#ffd0a0')
        : '#ffffff',
    };
  }

  function initStars() {
    stars = [];
    const count = Math.floor((W * H) / 4000);
    for (let i = 0; i < count; i++) stars.push(makeStar());
  }

  function makeShootingStar() {
    const angle = randomBetween(15, 45) * Math.PI / 180;
    return {
      x: randomBetween(0, W * 0.8),
      y: randomBetween(0, H * 0.5),
      len: randomBetween(80, 200),
      speed: randomBetween(8, 18),
      alpha: 1,
      angle,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      life: 0,
      maxLife: randomBetween(40, 80),
    };
  }

  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw stars
    for (const s of stars) {
      const a = s.alpha * (0.7 + 0.3 * Math.sin(t * s.speed * 1000 + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = a;
      ctx.fill();
    }

    // Shooting stars
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i];
      ss.life++;
      ss.x += ss.dx * ss.speed;
      ss.y += ss.dy * ss.speed;
      const progress = ss.life / ss.maxLife;
      ss.alpha = progress < 0.3
        ? progress / 0.3
        : 1 - (progress - 0.3) / 0.7;

      const grad = ctx.createLinearGradient(
        ss.x, ss.y,
        ss.x - ss.dx * ss.len * progress,
        ss.y - ss.dy * ss.len * progress
      );
      grad.addColorStop(0, `rgba(58,191,255,${ss.alpha})`);
      grad.addColorStop(1, 'rgba(58,191,255,0)');

      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - ss.dx * ss.len * progress, ss.y - ss.dy * ss.len * progress);
      ctx.strokeStyle = grad;
      ctx.globalAlpha = ss.alpha;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (ss.life >= ss.maxLife) shootingStars.splice(i, 1);
    }

    ctx.globalAlpha = 1;
    t += 0.016;
    requestAnimationFrame(draw);
  }

  // Spawn shooting stars periodically
  setInterval(() => {
    if (shootingStars.length < 3) {
      shootingStars.push(makeShootingStar());
    }
  }, 3500);

  window.addEventListener('resize', () => {
    resize();
    initStars();
  });

  resize();
  initStars();
  draw();
})();


// ---- FORMAT TABS ----
(function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.formats-panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      buttons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');

      const target = document.getElementById(`tab-${tab}`);
      if (target) {
        target.classList.add('active');

        // Animate items in
        const items = target.querySelectorAll('.format-item');
        items.forEach((item, i) => {
          item.style.opacity = '0';
          item.style.transform = 'translateY(10px)';
          setTimeout(() => {
            item.style.transition = 'opacity .25s ease, transform .25s ease';
            item.style.opacity = '1';
            item.style.transform = 'none';
          }, i * 20);
        });
      }
    });
  });
})();


// ---- SCROLL REVEAL ----
(function initReveal() {
  const targets = document.querySelectorAll(
    '.feature-card, .step, .format-item, .section-header, .dl-card, .stat'
  );

  targets.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = el.dataset.delay || 0;
          setTimeout(() => {
            el.classList.add('visible');
          }, parseInt(delay));
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.12 }
  );

  targets.forEach(el => observer.observe(el));
})();


// ---- NAVBAR SCROLL EFFECT ----
(function initNavbar() {
  const nav = document.querySelector('.navbar');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      nav.style.borderBottomColor = 'rgba(80, 180, 255, 0.3)';
      nav.style.background = 'rgba(2, 4, 10, 0.97)';
    } else {
      nav.style.borderBottomColor = 'rgba(80, 180, 255, 0.15)';
      nav.style.background = 'rgba(2, 4, 10, 0.85)';
    }
  }, { passive: true });
})();


// ---- SMOOTH ACTIVE NAV LINKS ----
(function initActiveLinks() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-links a');

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove('nav-active'));
          const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
          if (active) active.classList.add('nav-active');
        }
      });
    },
    { threshold: 0.5 }
  );

  sections.forEach(s => observer.observe(s));
})();


// ---- CURSOR GLOW (desktop only) ----
(function initCursorGlow() {
  if (window.innerWidth < 900) return;

  const glow = document.createElement('div');
  glow.style.cssText = `
    position: fixed;
    pointer-events: none;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(58,191,255,0.04) 0%, transparent 70%);
    transform: translate(-50%, -50%);
    z-index: 0;
    transition: opacity .3s;
  `;
  document.body.appendChild(glow);

  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });
})();


// ---- FEATURE CARD TILT (subtle) ----
(function initTilt() {
  if (window.innerWidth < 900) return;

  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();


// ---- TYPING ANIMATION for hero badge ----
(function initTyping() {
  const badge = document.querySelector('.hero-badge');
  if (!badge) return;

  const text = badge.textContent;
  badge.textContent = '';
  badge.style.animation = 'none';
  badge.style.opacity = '1';

  let i = 0;
  const interval = setInterval(() => {
    badge.textContent += text[i];
    i++;
    if (i >= text.length) clearInterval(interval);
  }, 50);
})();
