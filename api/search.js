export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:      process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results:  5,
    }),
  });

  if (!tavilyRes.ok) {
    const err = await tavilyRes.text();
    return res.status(502).json({ error: `Tavily error: ${err}` });
  }

  const data = await tavilyRes.json();
  const text = (data.results || [])
    .map(r => `${r.title}\n${r.url}\n${r.content}`)
    .join('\n\n');

  res.json({ text });
}
