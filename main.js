/* ============================================================
   THE JAISWAL GROUP REAL ESTATE — main.js
============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Sticky header on scroll ──
  const header = document.getElementById('site-header');
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // ── Mobile hamburger ──
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });

  // ── Animated stat counters ──
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  const animateCounters = (entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = +el.dataset.target;
      const duration = 1800;
      const step = target / (duration / 16);
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = Math.floor(current);
        if (current >= target) clearInterval(timer);
      }, 16);
      observer.unobserve(el);
    });
  };
  const counterObserver = new IntersectionObserver(animateCounters, { threshold: 0.5 });
  statNumbers.forEach(n => counterObserver.observe(n));

  // ── Testimonial slider ──
  const track = document.getElementById('testimonials-track');
  const dotsContainer = document.getElementById('t-dots');
  const cards = track ? track.querySelectorAll('.testimonial-card') : [];
  let current = 0;

  if (cards.length > 0) {
    // Build dots
    cards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 't-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    });

    const goTo = (index) => {
      current = (index + cards.length) % cards.length;
      track.style.transform = `translateX(-${current * 100}%)`;
      dotsContainer.querySelectorAll('.t-dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });
    };

    document.getElementById('t-prev').addEventListener('click', () => goTo(current - 1));
    document.getElementById('t-next').addEventListener('click', () => goTo(current + 1));

    // Auto-advance every 6s
    let autoSlide = setInterval(() => goTo(current + 1), 6000);
    track.parentElement.addEventListener('mouseenter', () => clearInterval(autoSlide));
    track.parentElement.addEventListener('mouseleave', () => {
      autoSlide = setInterval(() => goTo(current + 1), 6000);
    });
  }

  // ── Fade-in on scroll ──
  const fadeEls = document.querySelectorAll(
    '.about-text, .about-photo, .eir-card, .nbhd-card, .blog-card, .stat, .ql-tile, .testimonial-card'
  );
  fadeEls.forEach(el => el.classList.add('fade-in'));

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  fadeEls.forEach(el => fadeObserver.observe(el));

});

// ── Universal IDX widget shadow DOM styles ──
// Runs on any page with an idx-listings-showcase widget (community pages).
// Injects fonts, layout, and badge styles so all carousels look identical.
(function() {
  var TJG_WIDGET_CSS = `
    :host { background: transparent !important; }
    * { box-sizing: border-box; font-family: 'Lato', sans-serif !important; }
    [class*="price"], [class*="Price"] { font-family: 'Marcellus', serif !important; }
    .idx-showcase,
    .idx-showcase__grid,
    [class*="showcase"],
    [class*="listings-grid"],
    [class*="grid"] { background: transparent !important; }
    /* Hide courtesy text and header View All link */
    .idx-listing-card__courtesy { display: none !important; }
    .idx-listings-showcase__header a { display: none !important; }
    .idx-showcase__view-all,
    [class*="view-all"],
    [class*="viewAll"] { display: none !important; }
    /* Card wrap */
    .idx-listing-card__wrap { position: relative !important; overflow: hidden !important; }
    /* Status badge — move to top-left, style as solid navy pill */
    .idx-listing-card__banner-info {
      position: absolute !important;
      top: 0 !important; left: 0 !important; right: 0 !important; bottom: auto !important;
      z-index: 5 !important;
      display: flex !important;
      align-items: flex-start !important;
      justify-content: space-between !important;
      padding: 8px !important;
      background: transparent !important;
      pointer-events: none !important;
    }
    .idx-listing-card__prop-status,
    .idx-listing-card__status,
    [class*="prop-status"] {
      background: #18254B !important;
      color: #fff !important;
      padding: 4px 10px !important;
      font-family: 'Lato', sans-serif !important;
      font-size: 0.65rem !important;
      font-weight: 700 !important;
      letter-spacing: 0.1em !important;
      text-transform: uppercase !important;
      border-radius: 2px !important;
      pointer-events: auto !important;
      display: inline-block !important;
    }
    [class*="pending"] .idx-listing-card__prop-status { background: #9e8b7e !important; }
    .idx-listing-card__favorite { pointer-events: auto !important; }
    /* Details & MLS logo */
    .idx-listing-card__details { padding-bottom: 2rem !important; }
    .idx-listing-card__additional-info {
      position: absolute !important; bottom: 2rem !important; right: 1rem !important;
      background: transparent !important; padding: 0 !important; margin: 0 !important;
    }
    .idx-listing-card__mls { background: transparent !important; mix-blend-mode: multiply !important; }
    .idx-listing-card__mls img { height: 38px !important; width: auto !important; mix-blend-mode: multiply !important; background: transparent !important; }
    /* Open house widget uses idx-property-card__* class names */
    .idx-property-card__mls,
    .idx-property-card__mls-logo { background: transparent !important; mix-blend-mode: multiply !important; }
    .idx-property-card__mls img,
    .idx-property-card__mls-logo img { mix-blend-mode: multiply !important; background: transparent !important; }
  `;

  // Hide any showcase card whose status badge is not "Active".
  // IDX maps "Active Under Contract" to "Pending" on the card but still returns it
  // when filtering by Active status — CSS can't match text content, so we use JS.
  function hidePendingCards() {
    document.querySelectorAll('idx-listings-showcase').forEach(function(widget) {
      var root = widget.shadowRoot;
      if (!root) return;
      root.querySelectorAll('.idx-listing-card__prop-status').forEach(function(badge) {
        if (badge.textContent.trim().toLowerCase() === 'active') return;
        var card = badge.closest('.idx-listings-showcase__property');
        if (card) card.style.setProperty('display', 'none', 'important');
      });
    });
  }

  function applyWidgetStyles() {
    var widgets = document.querySelectorAll('idx-listings-showcase');
    if (!widgets.length) return;
    widgets.forEach(function(widget) {
      if (!widget.shadowRoot) return;
      if (widget.shadowRoot.getElementById('tjg-widget-styles')) return;
      var fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Marcellus&family=Lato:wght@300;400;700;900&display=swap';
      widget.shadowRoot.appendChild(fontLink);
      var style = document.createElement('style');
      style.id = 'tjg-widget-styles';
      style.textContent = TJG_WIDGET_CSS;
      widget.shadowRoot.appendChild(style);
      setupIDXLoginInterception(widget);
    });
  }

  // Intercept heart/favorite clicks inside the shadow DOM before IDX's popup fires.
  // Redirects straight to IDX account registration instead of showing the IDX login form.
  function setupIDXLoginInterception(widget) {
    var root = widget.shadowRoot;
    if (!root) return;
    if (root.getElementById('tjg-login-interceptor')) return;
    var marker = document.createElement('span');
    marker.id = 'tjg-login-interceptor';
    marker.style.display = 'none';
    root.appendChild(marker);

    root.addEventListener('click', function(e) {
      var btn = e.target.closest('[class*="favorite"], [class*="heart"], [class*="fav"], button[aria-label*="avorite"]');
      if (!btn) return;
      e.stopPropagation();
      e.preventDefault();
      window.open('https://thejaiswalgroup.idxbroker.com/i/account-registration', '_blank');
    }, true); // capture phase — fires before IDX's own listener
  }

  // Poll until widgets are ready, then stop
  var _widgetInterval = setInterval(function() {
    var widgets = document.querySelectorAll('idx-listings-showcase');
    if (!widgets.length) return;
    var allDone = true;
    widgets.forEach(function(w) {
      if (!w.shadowRoot || !w.shadowRoot.getElementById('tjg-widget-styles')) allDone = false;
    });
    applyWidgetStyles();
    hidePendingCards();
    if (allDone) clearInterval(_widgetInterval);
  }, 500);
  setTimeout(function() { clearInterval(_widgetInterval); }, 30000);
})();
