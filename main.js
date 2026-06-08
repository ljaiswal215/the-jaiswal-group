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
