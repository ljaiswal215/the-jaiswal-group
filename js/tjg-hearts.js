  (function() {
    var _loadCount = 0;

    function _close() {
      var m = document.getElementById('tjg-heart-modal');
      if (m) m.remove();
    }

    function _show() {
      var existing = document.getElementById('tjg-heart-modal');
      if (existing) existing.remove();
      _build();
      document.getElementById('tjg-heart-modal').style.display = 'flex';
    }

    function _buildConfirmation(bx) {
      Array.from(bx.children).forEach(function(ch, i) { if (i > 0) ch.style.display = 'none'; });
      var conf = document.createElement('div');
      conf.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:#F3EFE8;padding:36px 48px;text-align:center;gap:18px;border-radius:0 0 16px 16px;';
      var circle = document.createElement('div');
      circle.style.cssText = 'width:72px;height:72px;border-radius:50%;border:2px solid #18254B;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
      circle.innerHTML = '<svg viewBox="0 0 24 24" style="width:34px;height:34px;" fill="none" stroke="#18254B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      var heading = document.createElement('h2');
      heading.textContent = "You're In.";
      heading.style.cssText = 'font-family:Lato,sans-serif;font-size:26px;font-weight:700;color:#18254B;margin:0;';
      var body1 = document.createElement('p');
      body1.style.cssText = 'font-family:Lato,sans-serif;font-size:14px;line-height:1.7;color:#444;margin:0;max-width:400px;';
      body1.textContent = 'Welcome to The Jaiswal Group Real Estate. We have received your information and will be in touch shortly with your search alerts.';
      var body2 = document.createElement('p');
      body2.style.cssText = 'font-family:Lato,sans-serif;font-size:13px;line-height:1.6;color:#666;margin:0;max-width:380px;';
      body2.innerHTML = 'Questions? Call or text us anytime at <strong style="color:#444;">(858) 290-7531</strong>.';
      conf.appendChild(circle); conf.appendChild(heading); conf.appendChild(body1); conf.appendChild(body2);
      bx.appendChild(conf);
      setTimeout(function() { window.location.href = 'https://thejaiswalgroup.idxbroker.com/idx/myaccount'; }, 3000);
    }

    function _build() {
      var ov = document.createElement('div');
      ov.id = 'tjg-heart-modal';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(24,37,75,0.72);display:none;align-items:center;justify-content:center;';
      var bx = document.createElement('div');
      bx.style.cssText = 'width:88%;max-width:460px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 36px rgba(0,0,0,0.24);display:flex;flex-direction:column;font-family:Lato,sans-serif;';

      // Header
      var hdr = document.createElement('div');
      hdr.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;padding:16px 48px;background:#18254B;border-radius:16px 16px 0 0;flex-shrink:0;';
      var ht = document.createElement('span');
      ht.textContent = 'Register';
      ht.style.cssText = 'font-weight:700;font-size:13px;color:#fff;letter-spacing:0.1em;text-transform:uppercase;';
      var hx = document.createElement('button');
      hx.innerHTML = '&times;';
      hx.setAttribute('aria-label', 'Close');
      hx.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:26px;color:#fff;cursor:pointer;line-height:1;padding:0;opacity:0.8;';
      hx.addEventListener('click', _close);
      hdr.appendChild(ht); hdr.appendChild(hx);

      // Subtitle
      var sub = document.createElement('div');
      sub.style.cssText = 'background:#F3EFE8;padding:12px 20px;border-bottom:1px solid rgba(24,37,75,0.10);flex-shrink:0;text-align:center;';
      var subp = document.createElement('p');
      subp.textContent = 'Save your favorite homes, receive instant listing alerts, and access additional property information—all at no cost.';
      subp.style.cssText = 'margin:0;font-family:Lato,sans-serif;font-size:14px;color:#18254B;line-height:1.6;';
      sub.appendChild(subp);

      // Form fields
      var frm = document.createElement('div');
      frm.style.cssText = 'padding:16px 18px 0;display:flex;flex-direction:column;gap:11px;';
      function mkI(lbl, type, req) {
        var fw = document.createElement('div');
        var lb = document.createElement('label');
        lb.textContent = lbl + (req ? '' : ' (optional)');
        lb.style.cssText = 'display:block;font-size:0.62rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#18254B;margin-bottom:4px;';
        var inp = document.createElement('input');
        inp.type = type;
        inp.style.cssText = 'width:100%;box-sizing:border-box;border:1.5px solid #E0D9CF;border-radius:2px;padding:9px 12px;font-family:Lato,sans-serif;font-size:13px;color:#18254B;outline:none;';
        inp.addEventListener('focus', function() { inp.style.borderColor = '#18254B'; });
        inp.addEventListener('blur', function() { inp.style.borderColor = '#E0D9CF'; });
        fw.appendChild(lb); fw.appendChild(inp);
        return { wrap: fw, inp: inp };
      }
      function mkR(a, b) {
        var r = document.createElement('div');
        r.style.cssText = 'display:flex;gap:10px;';
        a.wrap.style.flex = '1'; b.wrap.style.flex = '1';
        r.appendChild(a.wrap); r.appendChild(b.wrap); return r;
      }
      var fi = mkI('First Name', 'text', true), la = mkI('Last Name', 'text', true);
      var em = mkI('Email', 'email', true), ph = mkI('Phone', 'tel', false);
      frm.appendChild(mkR(fi, la)); frm.appendChild(em.wrap); frm.appendChild(ph.wrap);

      // TCPA checkbox + submit
      var disc = document.createElement('div');
      disc.style.cssText = 'padding:14px 18px 18px;display:flex;flex-direction:column;gap:12px;';
      var chkRow = document.createElement('label');
      chkRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;cursor:pointer;';
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.style.cssText = 'margin-top:2px;flex-shrink:0;width:16px;height:16px;accent-color:#18254B;cursor:pointer;';
      var chkTxt = document.createElement('span');
      chkTxt.style.cssText = 'font-family:Lato,sans-serif;font-size:9.5px;line-height:1.55;color:#666;';
      chkTxt.innerHTML = 'By providing The Jaiswal Group Real Estate your contact information, you acknowledge and agree to our <a href="/privacy-policy.html" style="color:#18254B;" onclick="event.stopPropagation();">Privacy Policy</a> and consent to receiving marketing communications, including through automated calls, texts, and emails. Message and data rates may apply.';
      chkRow.appendChild(chk); chkRow.appendChild(chkTxt);
      var sb = document.createElement('button');
      sb.textContent = 'CREATE FREE ACCOUNT';
      sb.style.cssText = 'width:100%;background:#18254B;color:#fff;border:none;border-radius:2px;font-family:Lato,sans-serif;font-size:0.72rem;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;padding:14px;cursor:pointer;opacity:0.45;transition:color 0.2s,opacity 0.2s;';
      sb.disabled = true;
      chk.addEventListener('change', function() { sb.disabled = !chk.checked; sb.style.opacity = chk.checked ? '1' : '0.45'; });
      sb.addEventListener('mouseenter', function() { if (!sb.disabled) sb.style.color = '#B38987'; });
      sb.addEventListener('mouseleave', function() { sb.style.color = '#fff'; });
      sb.addEventListener('click', function() {
        var f = fi.inp.value.trim(), l = la.inp.value.trim(), e = em.inp.value.trim(), p = ph.inp.value.trim(), ok = true;
        if (!f) { fi.inp.style.borderColor = '#c0392b'; ok = false; }
        if (!l) { la.inp.style.borderColor = '#c0392b'; ok = false; }
        if (!e) { em.inp.style.borderColor = '#c0392b'; ok = false; }
        if (!ok) return;
        var subj = 'New Save Search Lead: ' + f + ' ' + l;
        var body = 'Name: ' + f + ' ' + l + '\nEmail: ' + e + (p ? '\nPhone: ' + p : '') + '\n\nSubmitted via Save Search on The Jaiswal Group website.';
        var _ml = document.createElement('a');
        _ml.href = 'mailto:office@thejaiswalgroup.com?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
        _ml.style.display = 'none';
        document.body.appendChild(_ml); _ml.click(); document.body.removeChild(_ml);
        _buildConfirmation(bx);
      });
      disc.appendChild(chkRow); disc.appendChild(sb);

      bx.appendChild(hdr); bx.appendChild(sub); bx.appendChild(frm); bx.appendChild(disc);
      ov.addEventListener('click', function(e) { if (e.target === ov) _close(); });
      ov.appendChild(bx);
      document.body.appendChild(ov);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _build);
    } else {
      setTimeout(_build, 0);
    }

    // ── Email popup ───────────────────────────────────────────────────────────
    function _showEmailPopup(listing) {
      if (document.getElementById('tjg-email-modal')) return;
      var url     = listing.url;
      var imgSrc  = listing.imgSrc;
      var price   = listing.price;
      var addr    = listing.addr;
      var beds    = listing.beds;
      var baths   = listing.baths;
      var sqft    = listing.sqft;
      var mls     = listing.mls;
      var logoSrc = listing.logoSrc;

      var ov = document.createElement('div');
      ov.id = 'tjg-email-modal';
      ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(24,37,75,0.72);display:flex;align-items:center;justify-content:center;';

      var bx = document.createElement('div');
      bx.style.cssText = 'width:88%;max-width:420px;max-height:92vh;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,0.22);display:flex;flex-direction:column;font-family:Lato,sans-serif;';

      var hdr = document.createElement('div');
      hdr.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;padding:14px 48px;background:#18254B;flex-shrink:0;border-radius:16px 16px 0 0;';
      var htitle = document.createElement('span');
      htitle.textContent = 'Share Property';
      htitle.style.cssText = 'font-weight:700;font-size:13px;color:#fff;letter-spacing:0.1em;text-transform:uppercase;text-align:center;';
      var hx = document.createElement('button');
      hx.innerHTML = '&times;';
      hx.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:26px;color:#fff;cursor:pointer;line-height:1;padding:0;opacity:0.8;';
      hx.addEventListener('click', function() { ov.remove(); });
      hdr.appendChild(htitle); hdr.appendChild(hx);
      bx.appendChild(hdr);

      var body = document.createElement('div');
      body.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;';

      if (imgSrc) {
        var photo = document.createElement('div');
        photo.style.cssText = 'width:100%;height:150px;background:#E0D9CF center/cover no-repeat;flex-shrink:0;';
        photo.style.backgroundImage = 'url(' + imgSrc + ')';
        body.appendChild(photo);
      }

      var info = document.createElement('div');
      info.style.cssText = 'background:#F3EFE8;padding:12px 18px 12px;border-bottom:1px solid rgba(24,37,75,0.10);flex-shrink:0;';
      var priceEl = document.createElement('div');
      priceEl.textContent = price || '';
      priceEl.style.cssText = 'font-size:17px;font-weight:700;color:#18254B;margin-bottom:3px;';
      info.appendChild(priceEl);
      if (beds || baths || sqft) {
        var bb = document.createElement('div');
        bb.textContent = [beds, baths, sqft ? sqft + ' sq. ft.' : ''].filter(Boolean).join(' · ');
        bb.style.cssText = 'font-size:12px;color:#18254B;margin-bottom:2px;';
        info.appendChild(bb);
      }
      if (addr) {
        var ad = document.createElement('div');
        ad.textContent = addr;
        ad.style.cssText = 'font-size:12px;color:#7a7269;margin-bottom:2px;';
        info.appendChild(ad);
      }
      var bottomRow = document.createElement('div');
      bottomRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:4px;';
      var mlsEl = document.createElement('span');
      mlsEl.textContent = mls ? 'MLS# ' + mls : '';
      mlsEl.style.cssText = 'font-size:11px;color:#aaa;';
      bottomRow.appendChild(mlsEl);
      if (logoSrc) {
        var logoImg = document.createElement('img');
        logoImg.src = logoSrc;
        logoImg.alt = 'CRMLS';
        logoImg.style.cssText = 'height:24px;width:auto;object-fit:contain;flex-shrink:0;mix-blend-mode:multiply;opacity:0.9;';
        bottomRow.appendChild(logoImg);
      }
      info.appendChild(bottomRow);
      body.appendChild(info);

      var form = document.createElement('div');
      form.style.cssText = 'padding:16px 18px 20px;display:flex;flex-direction:column;gap:11px;';

      function makeInput(labelTxt, type, placeholder, required) {
        var fw = document.createElement('div');
        var lbl = document.createElement('label');
        lbl.textContent = labelTxt + (required ? '' : ' (optional)');
        lbl.style.cssText = 'display:block;font-size:0.62rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#18254B;margin-bottom:4px;';
        var inp = document.createElement('input');
        inp.type = type;
        inp.placeholder = placeholder;
        inp.style.cssText = 'width:100%;box-sizing:border-box;border:1.5px solid #E0D9CF;border-radius:2px;padding:9px 12px;font-family:Lato,sans-serif;font-size:13px;color:#18254B;outline:none;';
        inp.addEventListener('focus', function() { inp.style.borderColor = '#18254B'; });
        inp.addEventListener('blur',  function() { inp.style.borderColor = '#E0D9CF'; });
        fw.appendChild(lbl); fw.appendChild(inp);
        return { wrap: fw, inp: inp };
      }

      function makeTextarea(labelTxt, defaultVal) {
        var fw = document.createElement('div');
        var lbl = document.createElement('label');
        lbl.textContent = labelTxt;
        lbl.style.cssText = 'display:block;font-size:0.62rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#18254B;margin-bottom:4px;';
        var ta = document.createElement('textarea');
        ta.value = defaultVal;
        ta.style.cssText = 'width:100%;box-sizing:border-box;border:1.5px solid #E0D9CF;border-radius:2px;padding:9px 12px;font-family:Lato,sans-serif;font-size:13px;color:#18254B;outline:none;resize:none;height:80px;line-height:1.5;';
        ta.addEventListener('focus', function() { ta.style.borderColor = '#18254B'; });
        ta.addEventListener('blur',  function() { ta.style.borderColor = '#E0D9CF'; });
        fw.appendChild(lbl); fw.appendChild(ta);
        return { wrap: fw, ta: ta };
      }

      function makeRow(fieldA, fieldB) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;';
        fieldA.wrap.style.flex = '1';
        fieldB.wrap.style.flex = '1';
        row.appendChild(fieldA.wrap);
        row.appendChild(fieldB.wrap);
        return row;
      }

      var firstField  = makeInput('First Name',       'text',  '', true);
      var lastField   = makeInput('Last Name',        'text',  '', true);
      var senderEmail = makeInput('Email',            'email', '', true);
      var phoneField  = makeInput('Phone',            'tel',   '', false);
      var recipEmail  = makeInput('Recipient Email',  'email', '', true);
      var msgField    = makeTextarea('Message', 'I came across this listing that I think you might like. Let me know what you think!');

      form.appendChild(makeRow(firstField, lastField));
      form.appendChild(senderEmail.wrap);
      form.appendChild(phoneField.wrap);
      form.appendChild(recipEmail.wrap);
      form.appendChild(msgField.wrap);

      var sendBtn = document.createElement('button');
      sendBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:#18254B;color:#fff;border:none;border-radius:2px;font-family:Lato,sans-serif;font-size:0.72rem;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;padding:14px;cursor:pointer;margin-top:2px;transition:color 0.2s;';
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;flex-shrink:0;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send';
      sendBtn.addEventListener('mouseenter', function() { sendBtn.style.color = '#B38987'; });
      sendBtn.addEventListener('mouseleave', function() { sendBtn.style.color = '#fff'; });
      sendBtn.addEventListener('click', function() {
        var first  = firstField.inp.value.trim();
        var last   = lastField.inp.value.trim();
        var semail = senderEmail.inp.value.trim();
        var phone  = phoneField.inp.value.trim();
        var remail = recipEmail.inp.value.trim();
        var msg    = msgField.ta.value.trim();
        var valid  = true;
        if (!first)  { firstField.inp.style.borderColor  = '#c0392b'; valid = false; }
        if (!last)   { lastField.inp.style.borderColor   = '#c0392b'; valid = false; }
        if (!semail) { senderEmail.inp.style.borderColor = '#c0392b'; valid = false; }
        if (!remail) { recipEmail.inp.style.borderColor  = '#c0392b'; valid = false; }
        if (!valid) return;
        var fullName = first + ' ' + last;
        var subject  = fullName + ' thinks you might like this home';
        var details  = [price, [beds, baths].filter(Boolean).join(' / '), addr, mls ? 'MLS# ' + mls : ''].filter(Boolean).join('\n');
        var emailBody = msg + '\n\n' + details + '\n' + url +
                        (phone ? '\n\nReach me at: ' + phone : '') +
                        '\n\nShared via The Jaiswal Group Real Estate';
        window.location.href = 'mailto:' + encodeURIComponent(remail) +
          '?subject=' + encodeURIComponent(subject) +
          '&body='    + encodeURIComponent(emailBody);
        setTimeout(function() { ov.remove(); }, 500);
      });
      form.appendChild(sendBtn);
      body.appendChild(form);
      bx.appendChild(body);

      ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
      ov.appendChild(bx);
      document.body.appendChild(ov);
    }

    // ── Share panel ───────────────────────────────────────────────────────────
    var ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    var ICON_SMS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    var ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
    var ICON_EMAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>';
    var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><polyline points="20 6 9 17 4 12"/></svg>';

    function _showSharePanel(e, listing) {
      document.querySelectorAll('#tjg-share-panel').forEach(function(p) { p.remove(); });
      var url = listing.url; var titleText = listing.titleText;
      var panel = document.createElement('div');
      panel.id = 'tjg-share-panel';
      panel.style.cssText = 'position:fixed;z-index:100000;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);width:290px;overflow:hidden;font-family:Lato,sans-serif;';
      var ph = document.createElement('div');
      ph.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid rgba(0,0,0,0.08);';
      var pt = document.createElement('span');
      pt.textContent = 'Share Property';
      pt.style.cssText = 'font-weight:700;font-size:14px;color:#18254B;';
      var px = document.createElement('button');
      px.innerHTML = '&times;';
      px.style.cssText = 'background:none;border:none;font-size:22px;color:#18254B;cursor:pointer;line-height:1;padding:0;opacity:0.45;';
      px.addEventListener('click', function() { panel.remove(); });
      ph.appendChild(pt); ph.appendChild(px);
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-around;padding:22px 8px 24px;';
      function makeOption(icon, label, onClick) {
        var btn = document.createElement('button');
        btn.style.cssText = 'background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:9px;padding:0 4px;';
        var ic = document.createElement('div');
        ic.style.cssText = 'width:52px;height:52px;border-radius:50%;background:#F3EFE8;display:flex;align-items:center;justify-content:center;color:#18254B;transition:background 0.15s,color 0.15s;';
        ic.innerHTML = icon;
        var lb = document.createElement('span');
        lb.textContent = label;
        lb.style.cssText = 'font-size:10px;font-weight:700;color:#18254B;letter-spacing:0.04em;white-space:nowrap;text-transform:uppercase;';
        btn.addEventListener('mouseenter', function() { ic.style.background = '#18254B'; ic.style.color = '#B38987'; });
        btn.addEventListener('mouseleave', function() { ic.style.background = '#F3EFE8'; ic.style.color = '#18254B'; });
        btn.addEventListener('click', function(ev) { ev.stopPropagation(); onClick(ic, lb); });
        btn.appendChild(ic); btn.appendChild(lb);
        return btn;
      }
      row.appendChild(makeOption(ICON_LINK, 'Copy Link', function(ic, lb) {
        navigator.clipboard.writeText(url).then(function() {
          ic.innerHTML = ICON_CHECK; ic.style.background = '#18254B'; ic.style.color = '#fff'; lb.textContent = 'Copied!';
          setTimeout(function() { panel.remove(); }, 1400);
        });
      }));
      row.appendChild(makeOption(ICON_SMS, 'Messages', function() {
        window.open('sms:?body=' + encodeURIComponent(titleText + ' ' + url));
        setTimeout(function() { panel.remove(); }, 300);
      }));
      row.appendChild(makeOption(ICON_SHARE, 'Share to', function() {
        if (navigator.share) { navigator.share({ title: titleText, url: url }).catch(function() {}); }
        else { navigator.clipboard.writeText(url); }
        setTimeout(function() { panel.remove(); }, 300);
      }));
      row.appendChild(makeOption(ICON_EMAIL, 'Email', function() {
        panel.remove(); _showEmailPopup(listing);
      }));
      panel.appendChild(ph); panel.appendChild(row);
      document.body.appendChild(panel);
      var vw = window.innerWidth; var vh = window.innerHeight;
      var pw = 290; var panH = panel.offsetHeight || 160;
      var left = Math.min(e.clientX - 145, vw - pw - 10);
      var top = e.clientY + 12;
      if (top + panH > vh - 10) top = e.clientY - panH - 12;
      panel.style.left = Math.max(10, left) + 'px';
      panel.style.top = top + 'px';
      setTimeout(function() {
        document.addEventListener('click', function _d() { panel.remove(); document.removeEventListener('click', _d); });
      }, 0);
    }

    var HEART_SVG = '<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    var SHARE_SVG = '<svg viewBox="0 0 24 24" style="width:18px;height:18px;display:block;fill:#fff;"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

    function _addHeart(card) {
      var wrap = card.querySelector('.idx-listing-card__wrap, .idx-listing-card__image-wrap, .idx-listing-card__image-area, .idx-listing-card__image, .idx-listing-card__photo');
      if (!wrap) wrap = card.firstElementChild;
      if (!wrap || wrap.querySelector('.tjg-heart')) return;
      if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

      var heart = document.createElement('button');
      heart.className = 'tjg-heart';
      heart.setAttribute('aria-label', 'Save this property');
      heart.innerHTML = HEART_SVG;
      heart.addEventListener('mouseenter', function() {
        heart.style.background = 'rgba(0,0,0,0.6)';
        var svg = heart.querySelector('svg');
        if (svg) { svg.style.stroke = '#B38987'; }
      });
      heart.addEventListener('mouseleave', function() {
        heart.style.background = 'rgba(0,0,0,0.35)';
        var svg = heart.querySelector('svg');
        if (svg) { svg.style.stroke = '#fff'; }
      });
      heart.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); _show();
      });

      var share = document.createElement('button');
      share.className = 'tjg-share';
      share.setAttribute('aria-label', 'Share this property');
      share.innerHTML = SHARE_SVG;
      share.addEventListener('mouseenter', function() {
        share.style.background = 'rgba(0,0,0,0.6)';
        var svg = share.querySelector('svg');
        if (svg) { svg.style.fill = '#B38987'; }
      });
      share.addEventListener('mouseleave', function() {
        share.style.background = 'rgba(0,0,0,0.35)';
        var svg = share.querySelector('svg');
        if (svg) { svg.style.fill = '#fff'; }
      });
      share.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        var link   = card.querySelector('.idx-listing-card__link, a[href*="/listing/"], a[href*="idxbroker"]');
        var href   = link ? link.href : window.location.href;
        var url    = href.replace('?widgetReferer=true', '');
        var mlsM   = href.match(/\/listing\/[^\/]+\/([^\/]+)\//);
        var addr   = (card.querySelector('.idx-listing-card__address, [class*="address"]')                         || {}).textContent || '';
        var price  = (card.querySelector('.idx-listing-card__listing-price, [class*="listing-price"], [class*="price"]:not([class*="reduced"])') || {}).textContent || '';
        var beds   = (card.querySelector('.idx-listing-card__bedrooms, [class*="bedrooms"], [class*="beds"]')     || {}).textContent || '';
        var baths  = (card.querySelector('.idx-listing-card__total-baths, [class*="baths"], [class*="bath"]')     || {}).textContent || '';
        var sqft = card.getAttribute('data-sqft') || '';
        if (!sqft) {
          var _els = card.querySelectorAll('*');
          for (var _si = 0; _si < _els.length; _si++) {
            var _el = _els[_si];
            if (_el.childElementCount === 0) {
              var _sm = _el.textContent.match(/(\d[\d,]+)\s*sq\.?\s*ft/i);
              if (_sm) { sqft = _sm[1]; break; }
            }
          }
        }
        var imgEl  = card.querySelector('img.idx-listing-card__image, img[class*="image"]');
        var logoEl = card.querySelector('.idx-listing-card__mls img, [class*="mls"] img, [class*="crmls"] img, [class*="attribution"] img');
        _showSharePanel(e, {
          url:       url,
          titleText: addr.trim() + (price ? ' - ' + price.trim() : ''),
          imgSrc:    imgEl  ? imgEl.src  : '',
          logoSrc:   logoEl ? logoEl.src : '',
          price:     price.trim(),
          addr:      addr.trim(),
          beds:      beds.trim(),
          baths:     baths.trim(),
          sqft:      sqft.trim(),
          mls:       mlsM ? mlsM[1] : ''
        });
      });

      wrap.appendChild(heart);
      wrap.appendChild(share);
    }

    function _initWidget(root) {
      if (!root.querySelector('#tjg-heart-styles')) {
        var st = document.createElement('style');
        st.id = 'tjg-heart-styles';
        st.textContent = [
          '.tjg-heart,.tjg-share{position:absolute;top:10px;z-index:15;width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;padding:0;color:#fff;transition:background 0.2s,color 0.2s;pointer-events:auto}',
          '.tjg-heart{right:54px}',
          '.tjg-share{right:10px}',
          '.tjg-heart:hover,.tjg-share:hover{background:rgba(0,0,0,0.6);color:#B38987}'
        ].join('');
        root.appendChild(st);
      }
      root.querySelectorAll('.idx-listing-card').forEach(_addHeart);
      new MutationObserver(function() {
        root.querySelectorAll('.idx-listing-card').forEach(_addHeart);
      }).observe(root, { childList: true, subtree: true });
    }

    var _watching = false;
    var _wt = setInterval(function() {
      if (_watching) { clearInterval(_wt); return; }
      var widget = document.querySelector('idx-listings-showcase');
      if (!widget || !widget.shadowRoot) return;
      _watching = true; clearInterval(_wt); _initWidget(widget.shadowRoot);
    }, 300);
    setTimeout(function() { clearInterval(_wt); }, 25000);

    // DOM mode: regular listing cards outside shadow DOM (e.g. mapsearch)
    (function() {
      var _domStyled = false;
      function _ensureDomStyles() {
        if (_domStyled || document.getElementById('tjg-heart-dom-styles')) return;
        _domStyled = true;
        var st = document.createElement('style');
        st.id = 'tjg-heart-dom-styles';
        st.textContent = [
          '.tjg-heart,.tjg-share{position:absolute;top:10px;z-index:15;width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;padding:0;transition:background 0.2s;pointer-events:auto}',
          '.tjg-heart{right:54px}',
          '.tjg-share{right:10px}',
          '.tjg-heart:hover,.tjg-share:hover{background:rgba(0,0,0,0.6)}'
        ].join('');
        document.head.appendChild(st);
      }
      function _scanDom() {
        var cards = document.querySelectorAll('.idx-listing-card');
        if (!cards.length) return;
        _ensureDomStyles();
        cards.forEach(function(card) {
          if (card.getRootNode() !== document) return;
          _addHeart(card);
        });
      }
      new MutationObserver(_scanDom).observe(document.body, { childList: true, subtree: true });
      [500, 1500, 3000, 5000].forEach(function(ms) { setTimeout(_scanDom, ms); });
    })();
  })();
  