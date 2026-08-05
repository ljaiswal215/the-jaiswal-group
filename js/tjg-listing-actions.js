/**
 * TJGListingActions — shared heart/share module
 * Drop onto any page that renders TJGCard with showActions:true.
 *
 * Requires:
 *   - @supabase/supabase-js v2 loaded before this script
 *   - TJGCard already loaded (for fmtPrice etc.)
 *
 * Provides globals:
 *   toggleHeart(btn)
 *   loadHeartedListings()
 *   shareListing(key, addrEnc)
 *   shareAction(type)
 *   closeShareModal()
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://ochdufbbntinllenqpwp.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_2rVwWfxV0m6XEeW3uGaz8w_eVFQpqYT';

  // ── Supabase client ────────────────────────────────────────────────────────
  var _sb = null;
  function getSb() {
    if (!_sb && window.supabase) _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return _sb;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  var _heartedKeys = new Set();
  var _allListings  = [];   // pages can push listings here for share lookup
  var _shareUrl     = '';
  var _shareAddr    = '';
  var _shareListing = null;

  // ── Inject share modal HTML (once) ────────────────────────────────────────
  function ensureShareModal() {
    if (document.getElementById('tjg-share-overlay')) return;
    var el = document.createElement('div');
    el.innerHTML = [
      '<div class="ls-share-overlay hidden" id="tjg-share-overlay" onclick="if(event.target===this)closeShareModal()">',
      '  <div class="ls-share-modal">',
      '    <p class="ls-share-title">Share This Home</p>',
      '    <button class="ls-share-close" onclick="closeShareModal()">&#x2715;</button>',
      '    <div class="ls-share-options">',
      '      <button class="ls-share-option" onclick="shareAction(\'copy\')">',
      '        <span class="ls-share-icon"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>',
      '        Copy Link',
      '      </button>',
      '      <button class="ls-share-option" onclick="shareAction(\'sms\')">',
      '        <span class="ls-share-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>',
      '        Text',
      '      </button>',
      '      <button class="ls-share-option" onclick="shareAction(\'native\')">',
      '        <span class="ls-share-icon"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></span>',
      '        Share',
      '      </button>',
      '    </div>',
      '    <p class="ls-share-copied" id="tjg-share-copied"></p>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(el.firstChild);
  }

  // ── Heart ──────────────────────────────────────────────────────────────────
  window.toggleHeart = async function (btn) {
    var key = btn.dataset.key;
    var sb  = getSb();
    if (!sb) return;

    var session = (await sb.auth.getSession()).data.session;
    if (!session || !session.user) {
      // Redirect to My Account so user can log in, then come back
      window.location.href = '/my-account.html';
      return;
    }

    var wasHearted = btn.classList.contains('hearted');
    var isHearted  = !wasHearted;

    // Optimistic update — all buttons sharing this key
    document.querySelectorAll('.ls-heart-btn[data-key="' + key + '"]').forEach(function (b) {
      if (isHearted) b.classList.add('hearted'); else b.classList.remove('hearted');
    });

    if (isHearted) {
      _heartedKeys.add(key);
      var res = await sb.from('saved_listings').upsert({
        user_id:     session.user.id,
        listing_key: key,
        address:     btn.dataset.addr  || null,
        price:       parseInt(btn.dataset.price)   || null,
        beds:        parseInt(btn.dataset.beds)    || null,
        baths:       parseFloat(btn.dataset.baths) || null,
        sqft:        parseInt(btn.dataset.sqft)    || null,
        photo_url:   btn.dataset.photo || null,
      });
      if (res.error) {
        _heartedKeys.delete(key);
        document.querySelectorAll('.ls-heart-btn[data-key="' + key + '"]').forEach(function (b) { b.classList.remove('hearted'); });
      }
    } else {
      _heartedKeys.delete(key);
      var res2 = await sb.from('saved_listings').delete()
        .eq('user_id', session.user.id).eq('listing_key', key);
      if (res2.error) {
        _heartedKeys.add(key);
        document.querySelectorAll('.ls-heart-btn[data-key="' + key + '"]').forEach(function (b) { b.classList.add('hearted'); });
      }
    }
  };

  window.loadHeartedListings = async function () {
    var sb = getSb();
    if (!sb) return;
    var session = (await sb.auth.getSession()).data.session;
    if (!session || !session.user) return;
    var res = await sb.from('saved_listings').select('listing_key').eq('user_id', session.user.id);
    if (res.data) {
      _heartedKeys = new Set(res.data.map(function (r) { return r.listing_key; }));
      _heartedKeys.forEach(function (k) {
        document.querySelectorAll('.ls-heart-btn[data-key="' + k + '"]').forEach(function (b) { b.classList.add('hearted'); });
      });
    }
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  window.shareListing = function (key, addrEnc) {
    _shareUrl     = window.location.origin + '/listing.html?key=' + key;
    _shareAddr    = decodeURIComponent(addrEnc);
    _shareListing = _allListings.find(function (l) { return l.ListingKey === key; }) || null;
    var copied = document.getElementById('tjg-share-copied');
    if (copied) copied.textContent = '';
    var overlay = document.getElementById('tjg-share-overlay') || document.getElementById('ls-share-overlay');
    if (overlay) overlay.classList.remove('hidden');
  };

  window.shareAction = window.shareAction || function (type) {
    var copied = document.getElementById('tjg-share-copied') || document.getElementById('ls-share-copied');
    var overlay = document.getElementById('tjg-share-overlay') || document.getElementById('ls-share-overlay');
    if (type === 'copy') {
      navigator.clipboard.writeText(_shareUrl).then(function () {
        if (copied) copied.textContent = 'Link copied!';
        setTimeout(closeShareModal, 1400);
      });
    } else if (type === 'sms') {
      window.open('sms:?body=' + encodeURIComponent(_shareAddr + ' ' + _shareUrl));
      closeShareModal();
    } else if (type === 'native') {
      if (navigator.share) {
        navigator.share({ title: _shareAddr, url: _shareUrl }).then(closeShareModal).catch(function () {});
      } else {
        navigator.clipboard.writeText(_shareUrl).then(function () {
          if (copied) copied.textContent = 'Link copied!';
          setTimeout(closeShareModal, 1400);
        });
      }
    }
  };

  window.closeShareModal = function () {
    var overlay = document.getElementById('tjg-share-overlay') || document.getElementById('ls-share-overlay');
    if (overlay) overlay.classList.add('hidden');
  };

  // ── Public registry so pages can register their listings array ─────────────
  window.TJGActions = {
    registerListings: function (arr) { _allListings = arr || []; },
    heartedKeys: _heartedKeys,
  };

  // ── Auto-init on DOM ready ─────────────────────────────────────────────────
  function init() {
    ensureShareModal();
    loadHeartedListings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
