/* ============================================================
   Progressive People - main.js
   Mobile nav, sliders, fade-on-scroll, FAQ accordion,
   contact form tabs, blog category filter
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initDropdownNav();
    initReveal();
    initFaq();
    initSlider();
    initContactTabs();
    initBlogFilter();
    initAnchorNavHighlight();
  });

  /* ----------------------------------------------------------
     Mobile navigation toggle
     ---------------------------------------------------------- */
  function initMobileNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-nav]');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close drawer when a nav link is clicked (except the dropdown trigger,
    // which toggles its submenu on mobile instead of navigating away).
    nav.querySelectorAll('a').forEach(function (link) {
      if (link.classList.contains('site-nav__link--dropdown')) return;
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ----------------------------------------------------------
     "What We Do" dropdown navigation
     Desktop: CSS hover/focus handles it.
     Mobile: tapping the trigger toggles the nested submenu.
     ---------------------------------------------------------- */
  function initDropdownNav() {
    var triggers = document.querySelectorAll('.site-nav__link--dropdown');
    var mq = window.matchMedia('(max-width: 1024px)');

    triggers.forEach(function (trigger) {
      var item = trigger.closest('.has-dropdown');
      var menu = item ? item.querySelector('.site-nav__dropdown') : null;
      if (!menu) return;

      trigger.addEventListener('click', function (e) {
        if (!mq.matches) return; // desktop uses hover
        e.preventDefault();
        var isOpen = menu.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  /* ----------------------------------------------------------
     Fade-up on scroll (IntersectionObserver)
     ---------------------------------------------------------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    els.forEach(function (el) { observer.observe(el); });
  }

  /* ----------------------------------------------------------
     FAQ accordion
     ---------------------------------------------------------- */
  function initFaq() {
    var items = document.querySelectorAll('.faq__item');
    items.forEach(function (item) {
      var btn = item.querySelector('.faq__question');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var isOpen = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  /* ----------------------------------------------------------
     Simple slider (sector slider)
     ---------------------------------------------------------- */
  function initSlider() {
    var sliders = document.querySelectorAll('[data-slider]');
    sliders.forEach(function (slider) {
      var track = slider.querySelector('.slider__track');
      var slides = slider.querySelectorAll('.slider__slide');
      var dotsWrap = slider.querySelector('.slider__dots');
      var prevBtn = slider.querySelector('[data-slider-prev]');
      var nextBtn = slider.querySelector('[data-slider-next]');
      if (!track || !slides.length) return;

      var index = 0;
      var total = slides.length;

      // Build dots
      var dots = [];
      if (dotsWrap) {
        for (var i = 0; i < total; i++) {
          var dot = document.createElement('button');
          dot.className = 'slider__dot';
          dot.setAttribute('aria-label', 'Slide ' + (i + 1));
          dot.dataset.slideIndex = i;
          dotsWrap.appendChild(dot);
          dots.push(dot);
        }
      }

      function go(n) {
        index = (n + total) % total;
        track.style.transform = 'translateX(' + (-index * 100) + '%)';
        dots.forEach(function (d, idx) {
          d.classList.toggle('is-active', idx === index);
        });
      }

      dots.forEach(function (d) {
        d.addEventListener('click', function () {
          go(parseInt(d.dataset.slideIndex, 10));
        });
      });

      if (prevBtn) prevBtn.addEventListener('click', function () { go(index - 1); });
      if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1); });

      go(0);

      // Auto-advance every 6s, pause on hover
      var autoplay = setInterval(function () { go(index + 1); }, 6000);
      slider.addEventListener('mouseenter', function () { clearInterval(autoplay); });
    });
  }

  /* ----------------------------------------------------------
     Contact form tab switcher
     ---------------------------------------------------------- */
  function initContactTabs() {
    var tabs = document.querySelectorAll('[data-form-tab]');
    var panels = document.querySelectorAll('[data-form-panel]');
    if (!tabs.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-form-tab');
        tabs.forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        panels.forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-form-panel') === target);
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Blog category filter (client-side)
     ---------------------------------------------------------- */
  function initBlogFilter() {
    var pills = document.querySelectorAll('[data-category-pill]');
    var cards = document.querySelectorAll('[data-category]');
    if (!pills.length) return;

    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        var cat = pill.getAttribute('data-category-pill');
        pills.forEach(function (p) {
          p.classList.toggle('is-active', p === pill);
        });
        cards.forEach(function (card) {
          var cardCat = card.getAttribute('data-category');
          var show = (cat === 'all' || cardCat === cat);
          card.style.display = show ? '' : 'none';
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Anchor nav scroll-spy (What We Do page)
     ---------------------------------------------------------- */
  function initAnchorNavHighlight() {
    var links = document.querySelectorAll('.anchor-nav__list a');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var targets = [];
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var t = document.getElementById(href.slice(1));
        if (t) targets.push({ link: link, target: t });
      }
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var match = targets.find(function (item) { return item.target === entry.target; });
        if (match && entry.isIntersecting) {
          targets.forEach(function (item) {
            item.link.classList.toggle('is-active', item === match);
          });
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    targets.forEach(function (item) { observer.observe(item.target); });
  }

  /* ----------------------------------------------------------
     Header solid state on scroll
     ---------------------------------------------------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
