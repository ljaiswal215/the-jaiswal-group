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

  // When a heart is clicked, IDX repositions its login form via inline style.
  // Watch for that style change, hide the form, and show our custom popup instead.
  function setupIDXLoginInterception(widget) {
    if (!widget.shadowRoot) return;
    if (widget.shadowRoot.getElementById('tjg-login-interceptor')) return;
    var marker = document.createElement('span');
    marker.id = 'tjg-login-interceptor';
    marker.style.display = 'none';
    widget.shadowRoot.appendChild(marker);

    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'style') continue;
        var el = mutation.target;
        var cls = typeof el.className === 'string' ? el.className : '';
        if (cls.indexOf('login-form') === -1) continue;
        // IDX sets top/left to position the form near the clicked heart
        var top = parseInt(el.style.top);
        if (!isNaN(top) && top > 0) {
          el.style.setProperty('display', 'none', 'important');
          showTJGFavoriteSignup();
        }
      }
    });
    observer.observe(widget.shadowRoot, { attributes: true, attributeFilter: ['style'], subtree: true });
  }

  function showTJGFavoriteSignup() {
    var existing = document.getElementById('tjg-favorite-modal');
    if (existing) { existing.style.display = 'flex'; return; }

    var style = document.createElement('style');
    style.textContent = [
      '#tjg-favorite-modal{position:fixed;inset:0;z-index:99999;background:rgba(18,28,60,0.55);display:flex;align-items:center;justify-content:center;}',
      '#tjg-favorite-modal-box{background:#fff;max-width:420px;width:90%;padding:2.5rem 2rem 2rem;text-align:center;position:relative;border-radius:2px;}',
      '#tjg-favorite-modal-close{position:absolute;top:0.75rem;right:1rem;background:none;border:none;font-size:1.4rem;cursor:pointer;color:#18254B;line-height:1;}',
      '#tjg-favorite-modal h2{font-family:"Marcellus",serif;color:#18254B;font-size:1.4rem;margin:0 0 0.65rem;}',
      '#tjg-favorite-modal p{font-family:"Lato",sans-serif;color:#444;font-size:0.9rem;line-height:1.6;margin:0 0 1.5rem;}',
      '#tjg-favorite-modal .tjg-fav-btn{display:inline-block;background:#18254B;color:#fff;padding:12px 32px;text-decoration:none;font-family:"Lato",sans-serif;font-size:0.75rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:1rem;}',
      '#tjg-favorite-modal .tjg-fav-btn:hover{background:#C4975A;}',
      '#tjg-favorite-modal .tjg-fav-signin{display:block;font-family:"Lato",sans-serif;font-size:0.82rem;color:#18254B;text-decoration:none;}',
      '#tjg-favorite-modal .tjg-fav-signin:hover{text-decoration:underline;}'
    ].join('');
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.id = 'tjg-favorite-modal';
    modal.innerHTML = [
      '<div id="tjg-favorite-modal-box">',
      '  <button id="tjg-favorite-modal-close" aria-label="Close">&times;</button>',
      '  <h2>Save This Listing</h2>',
      '  <p>Create a free account to save your favorite homes, track price changes, and stay up to date on new listings.</p>',
      '  <a href="/i/account-registration" class="tjg-fav-btn">Create Free Account</a>',
      '  <a href="/i/account-login" class="tjg-fav-signin">Already have an account? Sign In</a>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    document.getElementById('tjg-favorite-modal-close').addEventListener('click', function() {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.style.display = 'none';
    });
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
    if (allDone) clearInterval(_widgetInterval);
  }, 500);
  setTimeout(function() { clearInterval(_widgetInterval); }, 30000);
})();
