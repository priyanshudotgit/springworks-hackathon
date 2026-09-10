const crypto = require('crypto');

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('='); if (i === -1) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function perStudentStore(makeSeed, { ttlMs = 3 * 60 * 60 * 1000, sweepMs = 10 * 60 * 1000 } = {}) {
  const stores = new Map(); // sid -> { data, last }
  setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of stores) if (now - s.last > ttlMs) stores.delete(sid);
  }, sweepMs).unref();

  return function (req, res, next) {
    let sid = parseCookies(req).sid;
    if (!sid || !stores.has(sid)) {
      sid = crypto.randomBytes(12).toString('hex');
      stores.set(sid, { data: makeSeed(), last: Date.now() });
      res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
    }
    const s = stores.get(sid);
    s.last = Date.now();
    req.store = s.data;
    req.resetStore = () => { s.data = makeSeed(); req.store = s.data; };
    next();
  };
}
module.exports = { perStudentStore };
