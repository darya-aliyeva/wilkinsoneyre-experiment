// Fixed header contrast: every header item (logo, menu links, "Menu" button)
// checks what is right behind it and gets .is-light over a [data-header-dark]
// area (hero, dark cards), so it is always readable.
(() => {
  const header = document.querySelector('.header');
  if (!header) return;

  const items = header.querySelectorAll('.header__logo, .header__menu a, .header__burger');
  let ticking = false;

  function isDarkBehind(item) {
    const r = item.getBoundingClientRect();
    if (!r.width) return false; // hidden at this breakpoint
    const behind = document
      .elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      .find((el) => !header.contains(el));
    return Boolean(behind && behind.closest('[data-header-dark]'));
  }

  function update() {
    ticking = false;
    items.forEach((item) => item.classList.toggle('is-light', isDarkBehind(item)));
    header.classList.add('is-ready');
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  // Horizontal sliders move dark cards under the header too
  document.querySelectorAll('.slider').forEach((s) => s.addEventListener('scroll', requestUpdate, { passive: true }));

  update();
})();

// Scroll reveal: title-wraps, card grids (Architecture, services, News),
// Thinking / About paragraphs and photos, Career dropdowns and buttons get
// .is-visible once they scroll into view; the animations live in CSS.
(() => {
  // On mobile the Architecture grid is three rows tall, so revealing it as a
  // whole would play the lower cards off-screen — there each card is revealed
  // on its own as it scrolls in (with a small random offset within its row)
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const CARD_GRIDS = (mobile ? '.services__grid, .news__list' : '.architecture__grid, .services__grid, .news__list')
    + ', .case-about__list, .case-similar__list';
  // The Projects page grid is long at any width, so its cards always go one by one
  const SINGLES = '.section-text, .thinking__img, .about__photo, .about__round, .job, .portfolio__item, .office, .team__text, .team__img, .approach__intro, .drop, .sustain__text, .sustain__img, .years, .case-arch__img, .case-arch__text, .case-about__text, .case-updates__text, .case-updates__imgs > li, .case-ad__text, .case-ad__visual'
    + (mobile ? ', .architecture__grid > li' : '');
  const targets = document.querySelectorAll(`.section-head, .link-button, ${SINGLES}, ${CARD_GRIDS}`);

  document.querySelectorAll(`.portfolio__item${mobile ? ', .architecture__grid > li' : ''}`).forEach((card) => {
    card.style.setProperty('--reveal-delay', `${Math.random() < 0.5 ? 0 : 0.15}s`);
  });
  if (!targets.length) return;

  const STEP = 0.15; // seconds between cards

  // Cards appear in a random order rather than top to bottom
  function shuffleCardDelays(grid) {
    const cards = [...grid.children];
    const order = cards.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    cards.forEach((card, i) => card.style.setProperty('--reveal-delay', `${order[i] * STEP}s`));
  }

  function reveal(el) {
    if (el.matches(CARD_GRIDS)) shuffleCardDelays(el);
    el.classList.add('is-visible');
  }

  if (!('IntersectionObserver' in window)) {
    targets.forEach(reveal);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  targets.forEach((el) => observer.observe(el));
})();

// Sliders (Services, News, About project): drag with the mouse like a swipe.
// Touch and trackpads keep the native scrolling; only a mouse is handled here.
// While dragging, snapping is off (.is-dragging); on release the slider glides
// to the nearest card. A drag never counts as a click on a card link.
(() => {
  const sliders = document.querySelectorAll('.slider');
  if (!sliders.length) return;

  const THRESHOLD = 5; // px of movement before a press becomes a drag

  // The slider is only draggable while it actually scrolls (it's a grid on desktop)
  function updateDraggable() {
    sliders.forEach((slider) => {
      slider.classList.toggle('is-draggable', slider.scrollWidth > slider.clientWidth);
    });
  }

  // Scroll position at which each card sits at the start (scroll-padding included)
  function snapPoints(slider) {
    const padding = parseFloat(getComputedStyle(slider).scrollPaddingLeft) || 0;
    const left = slider.getBoundingClientRect().left;
    const max = slider.scrollWidth - slider.clientWidth;
    return [...slider.children].map((card) => {
      const point = slider.scrollLeft + card.getBoundingClientRect().left - left - padding;
      return Math.min(Math.max(point, 0), max);
    });
  }

  sliders.forEach((slider) => {
    let startX = 0;
    let startScroll = 0;
    let pointerId = null;
    let dragging = false;

    slider.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (!slider.classList.contains('is-draggable')) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = slider.scrollLeft;
      dragging = false;
    });

    slider.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;

      if (!dragging) {
        if (Math.abs(dx) < THRESHOLD) return;
        // Captured only now, so a plain click still reaches the card link
        dragging = true;
        try {
          slider.setPointerCapture(pointerId);
        } catch {
          // the pointer is already gone — the drag still works without capture
        }
        slider.classList.add('is-dragging');
      }

      slider.scrollLeft = startScroll - dx;
    });

    function release(event) {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;

      slider.classList.remove('is-dragging');
      const points = snapPoints(slider);
      const nearest = points.reduce((a, b) => (Math.abs(b - slider.scrollLeft) < Math.abs(a - slider.scrollLeft) ? b : a));
      slider.scrollTo({ left: nearest, behavior: 'smooth' });
    }

    slider.addEventListener('pointerup', release);
    slider.addEventListener('pointercancel', release);

    // The click that ends a drag must not open the card
    slider.addEventListener('click', (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = false;
    }, true);

    // No native "ghost image" dragging of photos and links
    slider.addEventListener('dragstart', (event) => event.preventDefault());
  });

  window.addEventListener('resize', updateDraggable);
  window.addEventListener('load', updateDraggable);
  updateDraggable();
})();

// Hero parallax: the background photo moves down at a quarter of the scroll
// speed while the hero is on screen (the photo is 25% taller in CSS for this).
(() => {
  const hero = document.querySelector('.hero');
  const photo = document.querySelector('.hero__bg');
  if (!hero || !photo) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SPEED = 0.25;
  let ticking = false;

  function update() {
    ticking = false;
    if (reduceMotion.matches) {
      photo.style.transform = '';
      return;
    }
    // Only while the hero is visible; its height limits the shift to 25%
    const scrolled = Math.min(Math.max(window.scrollY, 0), hero.offsetHeight);
    photo.style.transform = `translate3d(0, ${scrolled * SPEED}px, 0)`;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  update();
})();

// Mobile / tablet menu: the burger button slides the panel in from the right
// and slides it back out on the next click.
(() => {
  const button = document.querySelector('.header__burger');
  const menu = document.getElementById('mobile-menu');
  if (!button || !menu) return;

  const desktop = window.matchMedia('(min-width: 1024px)');

  function setOpen(open) {
    if (open) {
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbar}px`);
    }
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Close' : 'Menu';
    document.documentElement.classList.toggle('menu-open', open);
  }

  button.addEventListener('click', () => {
    setOpen(!menu.classList.contains('is-open'));
  });

  // A chosen link or Escape closes the menu
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      setOpen(false);
      button.focus();
    }
  });

  // The panel doesn't exist on desktop — reset if the window grows past it
  desktop.addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
})();

// Projects page side menu: "Experience / Status / Location" dropdowns.
// A card stays visible when it matches every filter. While any filter is set,
// the grid gets .is-filtered and drops the fixed Figma placement (see CSS).
// Shown cards replay the CSS fade on their own, coming back from display: none.
(() => {
  const filters = [...document.querySelectorAll('.filter[data-filter]')];
  const grid = document.querySelector('.portfolio__grid');
  if (!filters.length || !grid) return;

  const items = [...grid.children];
  const empty = document.querySelector('.portfolio__empty');
  const active = {};

  function apply() {
    let shown = 0;
    items.forEach((item) => {
      const match = Object.entries(active).every(([key, value]) => value === 'all' || item.dataset[key] === value);
      item.hidden = !match;
      if (match) shown++;
    });
    grid.classList.toggle('is-filtered', Object.values(active).some((value) => value !== 'all'));
    if (empty) empty.hidden = shown > 0;
  }

  function setOpen(filter, open) {
    filter.querySelector('.filter__toggle').setAttribute('aria-expanded', String(open));
    filter.querySelector('.filter__menu').hidden = !open;
  }

  filters.forEach((filter) => {
    const key = filter.dataset.filter;
    const toggle = filter.querySelector('.filter__toggle');
    const value = filter.querySelector('.filter__value');
    const options = filter.querySelectorAll('.filter__option');
    active[key] = filter.querySelector('[aria-pressed="true"]')?.dataset.value || 'all';

    // One dropdown open at a time
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      filters.forEach((other) => setOpen(other, other === filter && open));
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        options.forEach((o) => o.setAttribute('aria-pressed', String(o === option)));
        active[key] = option.dataset.value;
        value.textContent = option.textContent;
        setOpen(filter, false);
        toggle.focus();
        apply();
      });
    });
  });

  // A click elsewhere or Escape closes the open dropdown
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.filter')) filters.forEach((filter) => setOpen(filter, false));
  });

  document.addEventListener('keydown', (event) => {
    const open = filters.find((filter) => !filter.querySelector('.filter__menu').hidden);
    if (event.key === 'Escape' && open) {
      setOpen(open, false);
      open.querySelector('.filter__toggle').focus();
    }
  });

  apply();
})();

// Contacts page city clocks: the current time in each office's time zone
// ("am" / "09:54"), refreshed at the start of every minute.
(() => {
  const clocks = [...document.querySelectorAll('.clock[data-timezone]')];
  if (!clocks.length || !window.Intl) return;

  const formats = clocks.map((clock) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: clock.dataset.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return null; // unknown time zone: keep the time from the markup
    }
  });

  function update() {
    const now = new Date();
    clocks.forEach((clock, i) => {
      if (!formats[i]) return;
      const parts = Object.fromEntries(formats[i].formatToParts(now).map((p) => [p.type, p.value]));
      clock.querySelector('.clock__period').textContent = parts.dayPeriod.toLowerCase();
      clock.querySelector('.clock__hours').textContent = `${parts.hour}:${parts.minute}`;
    });
  }

  update();
  setTimeout(() => {
    update();
    setInterval(update, 60000);
  }, (60 - new Date().getSeconds()) * 1000);
})();

// Accordions: smooth open/close for the Career <details class="job"> (home)
// and the Approach <details class="drop"> (About page).
// Without JS the native <details name="..."> still works, just without animation.
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION = 450;
  const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  function setup(selector, headSelector, bodySelector) {
    const items = [...document.querySelectorAll(selector)];
    if (!items.length) return;

    // JS handles "only one open at a time" itself, so the native exclusive
    // behaviour (which closes the other item instantly) is switched off
    items.forEach((item) => item.removeAttribute('name'));

    function toggle(item, open) {
      const body = item.querySelector(bodySelector);
      const running = item._animation;

      item.classList.toggle('is-closing', !open);

      if (!body || reduceMotion.matches) {
        running?.cancel();
        item.open = open;
        item.classList.remove('is-closing');
        return;
      }

      // Start from the current height so a click mid-animation reverses smoothly
      const start = running ? body.getBoundingClientRect().height : open ? 0 : body.offsetHeight;
      running?.cancel();

      item.open = true;
      const end = open ? body.scrollHeight : 0;
      // Padding is animated too, otherwise the height can't collapse below it
      const padding = getComputedStyle(body).paddingTop;
      const startPadding = start === 0 ? '0px' : padding;

      body.style.overflow = 'hidden';
      const animation = body.animate(
        [
          { height: `${start}px`, paddingTop: startPadding, opacity: open ? 0 : 1 },
          { height: `${end}px`, paddingTop: open ? padding : '0px', opacity: open ? 1 : 0 },
        ],
        { duration: DURATION, easing: EASING }
      );
      item._animation = animation;

      // Rejected on cancel() — the next animation takes over from there
      animation.finished
        .then(() => {
          item._animation = null;
          item.open = open;
          item.classList.remove('is-closing');
          body.style.overflow = '';
        })
        .catch(() => {});
    }

    items.forEach((item) => {
      item.querySelector(headSelector).addEventListener('click', (event) => {
        event.preventDefault();
        const willOpen = !item.open || item.classList.contains('is-closing');

        if (willOpen) {
          items.forEach((other) => {
            if (other !== item && other.open && !other.classList.contains('is-closing')) {
              toggle(other, false);
            }
          });
        }

        toggle(item, willOpen);
      });
    });
  }

  setup('.job', '.job__head', '.job__body');
  setup('.drop', '.drop__head', '.drop__body');
})();
