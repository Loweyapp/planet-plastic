export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { chatId, stash } = req.body || {};
  if (!chatId || !Array.isArray(stash)) return res.status(400).json({ error: 'Missing chatId or stash' });
  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return res.status(500).json({ error: 'Redis not configured' });
  const r = await fetch(`${redisUrl}/set/mv:stash:${encodeURIComponent(chatId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(stash)),
  });
  if (!r.ok) { const err = await r.text(); return res.status(502).json({ error: `Redis error: ${err}` }); }
  res.json({ ok: true });
}
