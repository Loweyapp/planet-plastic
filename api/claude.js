// Serverless proxy for Anthropic API — avoids browser CORS issues,
// especially when using anthropic-beta headers (e.g. PDF support).

// Raise Vercel's default 4.5MB body limit to handle PDF payloads
export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  var apiKey = process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  var { messages, systemPrompt, tools, maxTokens, beta } = req.body || {};
  if (!messages) return res.status(400).json({ error: 'Missing messages' });

  var body = {
    model: 'claude-sonnet-5',
    max_tokens: maxTokens || 1000,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (tools)        body.tools  = tools;

  var headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (beta) headers['anthropic-beta'] = beta;

  try {
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    var data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data.error?.message || `HTTP ${resp.status}` });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
