(function () {
  var SB = window.SV_SCOREBOARD;
  var APP = window.SV_APP_ID;
  var TOKEN_KEY = 'sv_token';
  var locked = false;

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseJsonSafe(res) {
    return res.text().then(function (text) {
      try { return text ? JSON.parse(text) : {}; } catch (e) { return {}; }
    });
  }

  // --- styles (scoped under #sv-bug-widget so the host app's CSS can't touch it) ---
  var style = document.createElement('style');
  style.textContent = [
    '#sv-bug-widget, #sv-bug-widget * { all: initial; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; }',
    '#sv-bug-widget { position: fixed; bottom: 16px; right: 16px; z-index: 999999; display: block; }',
    '#sv-bug-widget .svbw-toggle { display: inline-block; cursor: pointer; background: #d64545; color: #fff; border: none; border-radius: 999px; padding: 10px 16px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }',
    '#sv-bug-widget .svbw-toggle:hover { background: #b83a3a; }',
    '#sv-bug-widget .svbw-panel { display: block; position: absolute; bottom: 48px; right: 0; width: 300px; max-height: 480px; overflow-y: auto; background: #fff; color: #222; border: 1px solid #ccc; border-radius: 8px; padding: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.35); }',
    '#sv-bug-widget .svbw-panel.svbw-hidden { display: none; }',
    '#sv-bug-widget label { display: block; margin-top: 8px; margin-bottom: 3px; font-weight: 600; color: #333; }',
    '#sv-bug-widget input, #sv-bug-widget select, #sv-bug-widget textarea { display: block; width: 100%; padding: 6px 8px; border: 1px solid #bbb; border-radius: 4px; background: #fff; color: #222; }',
    '#sv-bug-widget button.svbw-action { display: block; width: 100%; margin-top: 10px; cursor: pointer; background: #2b6cb0; color: #fff; border: none; border-radius: 4px; padding: 9px 12px; font-weight: 600; text-align: center; line-height: 1.2; }',
    '#sv-bug-widget button.svbw-action:hover { background: #235a91; }',
    '#sv-bug-widget .svbw-msg { display: block; margin-top: 8px; }',
    '#sv-bug-widget .svbw-msg.svbw-err { color: #c0392b; }',
    '#sv-bug-widget .svbw-msg.svbw-ok { color: #1e8449; }',
    '#sv-bug-widget .svbw-title { display: block; font-weight: 700; margin-bottom: 4px; }',
    '#sv-bug-widget .svbw-progress { display: block; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee; color: #555; font-size: 12px; }',
    '#sv-bug-widget .svbw-logout { display: block; margin-top: 10px; text-align: right; cursor: pointer; color: #2b6cb0; text-decoration: underline; }',
    '#sv-bug-widget .svbw-fixtrack { display: block; margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee; }',
    '#sv-bug-widget .svbw-fixtrack.svbw-hidden { display: none; }'
  ].join('\n');
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.id = 'sv-bug-widget';
  document.body.appendChild(root);

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'svbw-toggle';
  toggle.textContent = '🐛 Report a bug';
  root.appendChild(toggle);

  var panel = document.createElement('div');
  panel.className = 'svbw-panel svbw-hidden';
  root.appendChild(panel);

  toggle.addEventListener('click', function () {
    panel.classList.toggle('svbw-hidden');
    if (!panel.classList.contains('svbw-hidden')) render();
  });

  function render() {
    var token = getToken();
    if (!token) renderLogin();
    else renderReport();
  }

  function renderLogin(msg, isErr) {
    panel.innerHTML =
      '<span class="svbw-title">Log in</span>' +
      '<label for="svbw-email">Email</label>' +
      '<input id="svbw-email" type="email" autocomplete="username" />' +
      '<label for="svbw-password">Password</label>' +
      '<input id="svbw-password" type="password" autocomplete="current-password" />' +
      '<button type="button" class="svbw-action" id="svbw-login-btn">Log in</button>' +
      '<span class="svbw-msg' + (isErr ? ' svbw-err' : ' svbw-ok') + '" id="svbw-msg">' + escapeHtml(msg || '') + '</span>';

    panel.querySelector('#svbw-login-btn').addEventListener('click', function () {
      var email = panel.querySelector('#svbw-email').value;
      var password = panel.querySelector('#svbw-password').value;
      fetch(SB + '/login', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      }).then(function (res) {
        return parseJsonSafe(res).then(function (body) {
          if (res.status === 401) {
            renderLogin('Wrong email/password', true);
          } else if (res.ok && body && body.token) {
            setToken(body.token);
            renderReport();
          } else {
            renderLogin('Login failed', true);
          }
        });
      }).catch(function () {
        renderLogin('Network error, try again', true);
      });
    });
  }

  function renderReport() {
    panel.innerHTML =
      '<span class="svbw-title">Report a bug</span>' +
      '<span class="svbw-progress" id="svbw-progress">Loading progress…</span>' +
      '<label for="svbw-endpoint">Endpoint</label>' +
      '<select id="svbw-endpoint"><option>Loading...</option></select>' +
      '<label for="svbw-defect-type">Defect type</label>' +
      '<select id="svbw-defect-type"><option>Loading...</option></select>' +
      '<label for="svbw-description">Describe the issue</label>' +
      '<textarea id="svbw-description" rows="3" placeholder="Describe the issue" required></textarea>' +
      '<label for="svbw-expected-actual">Expected vs actual</label>' +
      '<textarea id="svbw-expected-actual" rows="3" placeholder="Expected vs actual" required></textarea>' +
      '<button type="button" class="svbw-action" id="svbw-submit-btn">Submit</button>' +
      '<span class="svbw-msg" id="svbw-msg"></span>' +
      '<div class="svbw-fixtrack svbw-hidden" id="svbw-fixtrack">' +
      '<span class="svbw-title">🔧 Phase 2 — write tests that catch your bugs</span>' +
      '<span class="svbw-progress">Download your code + bug report, write tests that FAIL because of the bugs, then submit your repo. Fixing the bugs is an optional bonus. Run locally: npm install &amp;&amp; npm start</span>' +
      '<button type="button" class="svbw-action" id="svbw-download-btn">Download my app (.zip)</button>' +
      '<button type="button" class="svbw-action" id="svbw-bugreport-btn">Download my bug report</button>' +
      '<label for="svbw-repo-url">GitHub repo URL</label>' +
      '<input id="svbw-repo-url" type="text" placeholder="https://github.com/you/repo" />' +
      '<label for="svbw-ai-tools">Tools used (which, and what for) — required</label>' +
      '<textarea id="svbw-ai-tools" rows="2" placeholder="e.g. your editor, a test runner, and anything that helped write your tests" required></textarea>' +
      '<button type="button" class="svbw-action" id="svbw-submitfix-btn">Submit my repo</button>' +
      '<span class="svbw-msg" id="svbw-fixtrack-msg"></span>' +
      '</div>' +
      '<span class="svbw-logout" id="svbw-logout">Log out</span>';

    var endpointSel = panel.querySelector('#svbw-endpoint');
    var defectSel = panel.querySelector('#svbw-defect-type');
    var msgEl = panel.querySelector('#svbw-msg');
    var progressEl = panel.querySelector('#svbw-progress');
    var submitBtn = panel.querySelector('#svbw-submit-btn');
    var fixtrackEl = panel.querySelector('#svbw-fixtrack');
    var fixMsgEl = panel.querySelector('#svbw-fixtrack-msg');

    function setMsg(text, tone) {
      msgEl.textContent = text || '';
      msgEl.className = 'svbw-msg' + (tone === 'err' ? ' svbw-err' : tone === 'ok' ? ' svbw-ok' : '');
    }

    function setFixMsg(text, tone) {
      fixMsgEl.textContent = text || '';
      fixMsgEl.className = 'svbw-msg' + (tone === 'err' ? ' svbw-err' : tone === 'ok' ? ' svbw-ok' : '');
    }

    function lockOut() {
      locked = true;
      setMsg('⛔ No attempts left — submissions locked.', 'err');
      submitBtn.disabled = true;
      endpointSel.disabled = true;
      defectSel.disabled = true;
    }

    if (locked) lockOut();

    function fetchProgress() {
      var token = getToken();
      if (!token) { progressEl.textContent = '—'; return; }
      fetch(SB + '/api/my-progress', {
        mode: 'cors',
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(function (res) {
        return parseJsonSafe(res).then(function (data) {
          if (!res.ok || !data || typeof data.found !== 'number' || typeof data.total !== 'number') {
            progressEl.textContent = '—';
            return;
          }
          var text = 'Found ' + data.found + ' of ' + data.total + ' bugs · ' + Math.max(0, data.total - data.found) + ' left';
          if (typeof data.attemptsBudget === 'number' && typeof data.attemptsLeft === 'number') {
            text += ' · Attempts left: ' + data.attemptsLeft;
          }
          progressEl.textContent = text;
          if (data.attemptsLeft === 0) lockOut();
          fixtrackEl.classList.toggle('svbw-hidden', data.fixUnlocked !== true);
        });
      }).catch(function () {
        progressEl.textContent = '—';
      });
    }

    fetchProgress();

    function fillSelect(sel, items) {
      sel.innerHTML = '';
      if (!Array.isArray(items) || items.length === 0) {
        var opt = document.createElement('option');
        opt.textContent = 'None available';
        sel.appendChild(opt);
        return;
      }
      items.forEach(function (item) {
        var value = typeof item === 'string' ? item : (item && (item.value || item.name || item.label || item.type)) || '';
        var label = typeof item === 'string' ? item : (item && (item.label || item.name || item.type || item.value)) || value;
        var opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        sel.appendChild(opt);
      });
    }

    fetch(SB + '/api/routes?app=' + encodeURIComponent(APP), { mode: 'cors' })
      .then(function (res) { return parseJsonSafe(res); })
      .then(function (data) {
        fillSelect(endpointSel, data);
        var uiOpt = endpointSel.querySelector('option[value="UI"]');
        if (uiOpt) uiOpt.textContent = 'UI / frontend';
      })
      .catch(function () { fillSelect(endpointSel, []); });

    fetch(SB + '/api/taxonomy', { mode: 'cors' })
      .then(function (res) { return parseJsonSafe(res); })
      .then(function (data) { fillSelect(defectSel, data); })
      .catch(function () { fillSelect(defectSel, []); });

    panel.querySelector('#svbw-logout').addEventListener('click', function () {
      clearToken();
      locked = false;
      renderLogin();
    });

    panel.querySelector('#svbw-download-btn').addEventListener('click', function () {
      fetch(SB + '/api/download-app', {
        mode: 'cors',
        headers: { 'Authorization': 'Bearer ' + getToken() }
      }).then(function (res) {
        if (!res.ok) {
          setFixMsg('Download not ready — try again', 'err');
          return;
        }
        return res.blob().then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = APP + '.zip';
          a.click();
          URL.revokeObjectURL(url);
        });
      }).catch(function () {
        setFixMsg('Download not ready — try again', 'err');
      });
    });

    panel.querySelector('#svbw-bugreport-btn').addEventListener('click', function () {
      fetch(SB + '/api/download-bug-report', {
        mode: 'cors',
        headers: { 'Authorization': 'Bearer ' + getToken() }
      }).then(function (res) {
        if (!res.ok) { setFixMsg('Bug report not ready — try again', 'err'); return; }
        return res.blob().then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'my-bug-report.md';
          a.click();
          URL.revokeObjectURL(url);
        });
      }).catch(function () {
        setFixMsg('Bug report not ready — try again', 'err');
      });
    });

    panel.querySelector('#svbw-submitfix-btn').addEventListener('click', function () {
      var repoUrl = panel.querySelector('#svbw-repo-url').value;
      var aiTools = panel.querySelector('#svbw-ai-tools').value;
      if (!aiTools.trim()) {
        setFixMsg('List the tools you used (required).', 'err');
        return;
      }
      fetch(SB + '/api/submit-fix', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ repo_url: repoUrl, ai_tools: aiTools })
      }).then(function (res) {
        return parseJsonSafe(res).then(function (data) {
          if (res.status === 400) {
            setFixMsg('Enter a valid repo URL', 'err');
            return;
          }
          if (res.status === 403) {
            setFixMsg('⛔ Fix Track locked.', 'err');
            return;
          }
          if (data && data.ok) {
            setFixMsg('✓ Fix submitted: ' + data.repo_url, 'ok');
            return;
          }
          setFixMsg('Unexpected response', 'err');
        });
      }).catch(function () {
        setFixMsg('Network error, try again', 'err');
      });
    });

    submitBtn.addEventListener('click', function () {
      var descriptionEl = panel.querySelector('#svbw-description');
      var expectedActualEl = panel.querySelector('#svbw-expected-actual');
      var description = descriptionEl.value;
      var expectedActual = expectedActualEl.value;
      if (!description.trim() || !expectedActual.trim()) {
        setMsg('Please describe the issue and the expected vs actual.', 'err');
        return;
      }
      var token = getToken();
      var body = {
        app: APP,
        endpoint: endpointSel.value,
        defect_type: defectSel.value,
        description: description,
        expected_actual: expectedActual
      };
      fetch(SB + '/api/submit', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(body)
      }).then(function (res) {
        return parseJsonSafe(res).then(function (data) {
          if (res.status === 401) {
            clearToken();
            renderLogin('Session expired, please log in again', true);
            return;
          }
          if (res.status === 423) {
            setMsg('⛔ Reporting is closed — the Fix Track is open below.', 'err');
            fetchProgress();
            return;
          }
          if (res.status === 429) {
            lockOut();
            fetchProgress();
            return;
          }
          if (res.status === 403) {
            setMsg('⛔ Not your assigned app (yours: ' + (data && data.assigned != null ? data.assigned : '?') + ').', 'err');
            fetchProgress();
            return;
          }
          if (data && data.matched) {
            if (data.alreadySubmitted) {
              setMsg('✓ You already found ' + data.matched + '.', 'neutral');
            } else {
              setMsg('✓ Correct — ' + data.matched + ' found!', 'ok');
            }
            descriptionEl.value = '';
            expectedActualEl.value = '';
            fetchProgress();
            return;
          }
          if (data && data.matched === null) {
            setMsg('✗ Not a scored bug here — keep looking.', 'err');
            fetchProgress();
            return;
          }
          setMsg('Unexpected response', 'err');
        });
      }).catch(function () {
        setMsg('Network error, try again', 'err');
      });
    });
  }
})();
