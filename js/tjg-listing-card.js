/**
 * TJGCard — shared listing card module
 * Single source of truth for all listing card HTML across the site.
 *
 * Usage:
 *   TJGCard.render(listing, opts)   → HTML string for one card
 *   TJGCard.renderSkeleton(count)   → shimmer skeleton HTML string
 *   TJGCard.fmtPrice(n)             → formatted price string
 *   TJGCard.fmtStatus(s)            → normalized status label
 *   TJGCard.badgeCls(s)             → badge CSS class name
 *   TJGCard.buildAddr(l)            → full address string
 *   TJGCard.toTitleCase(str)        → title-cased string
 */
(function () {
  'use strict';

  var HEART_PATH = 'm13.155 20.634.016-.008.014-.01c2.61-1.604 4.793-3.37 6.333-5.253S22 11.422 22 9.263C22 5.652 19.374 3 15.952 3c-1.765 0-3.01 1.101-3.744 2.018a8 8 0 0 0-.203.265 8 8 0 0 0-.201-.263C11.069 4.099 9.824 3 8.048 3 4.626 3 2 5.651 2 9.264c0 2.158.941 4.215 2.483 6.1 1.541 1.882 3.726 3.648 6.341 5.253h0l.012.007c.135.08.3.165.477.234.158.06.41.142.687.142s.528-.081.685-.141c.175-.067.34-.15.47-.225Z';

  var HOUSE_SVG = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';

  var SHARE_SVG = '<svg viewBox="0 0 24 24" class="ls-send-icon"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  var CRMLS_LOGO_PATH = 'LOGOS/logo-crmls.png';

  function toTitleCase(str) {
    if (!str) return '';
    return String(str).replace(/\w\S*/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  function fmtPrice(n) {
    if (!n) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function fmtStatus(s) {
    if (s === 'ComingSoon') return 'Coming Soon';
    if (s === 'Closed') return 'Sold';
    return s || 'Active';
  }

  function badgeCls(s) {
    if (s === 'Pending') return 'ls-badge-pending';
    if (s === 'ComingSoon' || s === 'Coming Soon') return 'ls-badge-coming';
    if (s === 'Closed' || s === 'Sold') return 'ls-badge-sold';
    return 'ls-badge-active';
  }

  function buildAddr(l) {
    var unit = l.UnitNumber ? ' #' + l.UnitNumber : '';
    var streetParts = [l.StreetNumber, l.StreetName, l.StreetSuffix].filter(Boolean);
    var street = streetParts.length ? streetParts.join(' ') + unit : 'Private Address';
    var cityParts = [
      toTitleCase(l.City || ''),
      (l.StateOrProvince || 'CA'),
      l.PostalCode || ''
    ].filter(Boolean);
    return street + ', ' + cityParts.join(' ');
  }

  /**
   * Render a single listing card.
   *
   * @param {Object} l        - listing data object
   * @param {Object} [opts]   - rendering options
   * @param {string} [opts.basePath='']         - path prefix for hrefs (e.g. '../' for neighborhood pages)
   * @param {boolean} [opts.showActions=true]   - show heart/share action buttons
   * @param {string} [opts.heartFn='toggleHeart(this)'] - onclick for heart button
   * @param {string} [opts.shareFn='shareListing']      - share function name (called as shareFn(key, addrEnc))
   * @param {boolean} [opts.hearted=false]      - whether heart is initially filled
   * @param {string} [opts.bodyTop='']          - HTML to inject at the top of the card body (before price)
   * @param {string} [opts.badgeLabel]          - override badge text (e.g. 'Open House')
   * @param {string} [opts.badgeClass]          - override badge CSS class
   * @returns {string} HTML string
   */
  function render(l, opts) {
    opts = opts || {};
    var basePath    = opts.basePath    !== undefined ? opts.basePath    : '';
    var showActions = opts.showActions !== undefined ? opts.showActions : true;
    var heartFn     = opts.heartFn     !== undefined ? opts.heartFn     : 'toggleHeart(this)';
    var shareFn     = opts.shareFn     !== undefined ? opts.shareFn     : 'shareListing';
    var hearted     = opts.hearted     ? ' hearted' : '';
    var bodyTop     = opts.bodyTop     || '';

    var photoUrl = (l.Media || [])[0]
      ? ((l.Media[0].MediaURL || l.Media[0].mediaUrl) || '')
      : (l.photo || '');

    var addr    = buildAddr(l);
    var addrEnc = encodeURIComponent(addr);
    var key     = l.ListingKey || '';

    // Image or placeholder
    var imgHtml = photoUrl
      ? '<img src="' + photoUrl + '" alt="' + addr.replace(/"/g, '&quot;') + '" loading="lazy" onerror="if(window.TJGCard)TJGCard.imgError(this)" />'
      : '<div class="ls-card-img-placeholder">' + HOUSE_SVG + '</div>';

    // Badge
    var status    = l.StandardStatus || 'Active';
    var badgeText = opts.badgeLabel || fmtStatus(status);
    var badgeKls  = opts.badgeClass || badgeCls(status);
    var badge     = '<span class="ls-badge ' + badgeKls + '">' + badgeText + '</span>';

    // Action buttons
    var actionsHtml = '';
    if (showActions) {
      var heartClass = 'ls-action-btn ls-heart-btn' + hearted;
      var heartBtn = '<button class="' + heartClass + '"'
        + ' data-key="' + key + '"'
        + ' data-addr="' + addr.replace(/'/g, '&#39;') + '"'
        + ' data-price="' + (l.ListPrice || '') + '"'
        + ' data-beds="' + (l.BedroomsTotal || '') + '"'
        + ' data-baths="' + (l.BathroomsTotalInteger || '') + '"'
        + ' data-sqft="' + (l.LivingArea || '') + '"'
        + ' data-photo="' + (photoUrl || '') + '"'
        + ' onclick="event.preventDefault(); ' + heartFn + '" title="Save">'
        + '<svg viewBox="0 0 24 24"><path d="' + HEART_PATH + '"/></svg>'
        + '</button>';
      var shareBtn = '<button class="ls-action-btn"'
        + ' onclick="event.preventDefault(); ' + shareFn + '(\'' + key + '\', \'' + addrEnc + '\')" title="Share">'
        + SHARE_SVG
        + '</button>';
      actionsHtml = '<div class="ls-card-actions">' + heartBtn + shareBtn + '</div>';
    }

    // Facts
    var factsHtml = '';
    if (l.BedroomsTotal)         factsHtml += '<span>' + l.BedroomsTotal + ' bd</span>';
    if (l.BathroomsTotalInteger) factsHtml += '<span>' + l.BathroomsTotalInteger + ' ba</span>';
    if (l.LivingArea)            factsHtml += '<span>' + Number(l.LivingArea).toLocaleString('en-US') + ' sqft</span>';

    // MLS row
    var mlsRow = l.ListingId
      ? '<div class="ls-card-mls"><span>MLS\u00ae: ' + l.ListingId + '</span><img src="' + basePath + CRMLS_LOGO_PATH + '" alt="CRMLS" class="ls-crmls-logo" /></div>'
      : '';

    var href = basePath + 'listing.html?key=' + encodeURIComponent(key);

    return '<a class="ls-card" href="' + href + '">'
      + '<div class="ls-card-img">'
      +   imgHtml
      +   badge
      +   actionsHtml
      + '</div>'
      + '<div class="ls-card-body">'
      +   bodyTop
      +   '<div class="ls-card-price">' + fmtPrice(l.ListPrice) + '</div>'
      +   '<div class="ls-card-facts">' + factsHtml + '</div>'
      +   '<div class="ls-card-address">' + addr + '</div>'
      +   mlsRow
      + '</div>'
      + '</a>';
  }

  /**
   * Render skeleton shimmer placeholder cards.
   * @param {number} [count=4]
   * @returns {string} HTML string
   */
  function renderSkeleton(count) {
    count = (count === undefined || count === null) ? 4 : count;
    var skel = '<div class="ls-card ls-card-skeleton">'
      + '<div class="ls-card-img ls-skel-img"></div>'
      + '<div class="ls-card-body">'
      +   '<div class="ls-skel-line lg"></div>'
      +   '<div class="ls-skel-line sm"></div>'
      +   '<div class="ls-skel-line xs"></div>'
      + '</div>'
      + '</div>';
    var out = '';
    for (var i = 0; i < count; i++) out += skel;
    return out;
  }

  function imgError(img) {
    var parent = img.closest('.ls-card-img');
    if (parent) parent.innerHTML = '<div class="ls-card-img-placeholder">' + HOUSE_SVG + '</div>';
  }

  var TJGCard = {
    render:         render,
    renderSkeleton: renderSkeleton,
    imgError:       imgError,
    fmtPrice:       fmtPrice,
    fmtStatus:      fmtStatus,
    badgeCls:       badgeCls,
    buildAddr:      buildAddr,
    toTitleCase:    toTitleCase,
  };

  if (typeof window !== 'undefined') window.TJGCard = TJGCard;
  if (typeof module !== 'undefined' && module.exports) module.exports = TJGCard;
})();
