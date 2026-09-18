// GET  /api/follow?username=X            -> { following: [...], followers: [...] }
// POST /api/follow  { username, target, action: 'follow'|'unfollow' }
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const store = getStore('vidfeed-follows');

  if (event.httpMethod === 'GET') {
    const username = ((event.queryStringParameters && event.queryStringParameters.username) || '').toLowerCase();
    if (!username) return { statusCode: 400, body: JSON.stringify({ error: 'username wajib diisi' }) };
    const data = (await store.get(username, { type: 'json' })) || { following: [], followers: [] };
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
    const username = (body.username || '').toLowerCase();
    const target = (body.target || '').toLowerCase();
    const action = body.action;

    if (!username || !target || username === target) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Data tidak valid' }) };
    }

    const me = (await store.get(username, { type: 'json' })) || { following: [], followers: [] };
    const other = (await store.get(target, { type: 'json' })) || { following: [], followers: [] };

    if (action === 'follow') {
      if (!me.following.includes(target)) me.following.push(target);
      if (!other.followers.includes(username)) other.followers.push(username);
    } else if (action === 'unfollow') {
      me.following = me.following.filter((u) => u !== target);
      other.followers = other.followers.filter((u) => u !== username);
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Aksi tidak dikenal' }) };
    }

    await store.set(username, JSON.stringify(me));
    await store.set(target, JSON.stringify(other));

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
};
