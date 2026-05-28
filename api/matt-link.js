export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  var { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  var botUrl = process.env.MATT_BOT_URL || 'https://matt-varnish-bot.vercel.app';
  var secret = process.env.CHAT_API_SECRET;
  if (!secret) return res.status(500).json({ error: 'CHAT_API_SECRET not configured' });

  try {
    var response = await fetch(`${botUrl}/api/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify({ action: 'validate', code: String(code).trim() }),
    });

    var data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
