var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
};

export default async function handler(req, res) {
  var q = req.query.q || '';
  if (!q) return res.status(400).end();

  try {
    // Step 1: get vqd token from DDG search page
    var searchUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(q + ' model kit box art') + '&iax=images&ia=images';
    var searchRes = await fetch(searchUrl, {
      headers: { ...HEADERS, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    var html = await searchRes.text();

    var vqdMatch = html.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) return res.status(404).json({ error: 'No vqd token' });
    var vqd = vqdMatch[1];

    // Step 2: fetch image results
    var apiUrl = 'https://duckduckgo.com/i.js?l=wt-wt&o=json&q=' +
      encodeURIComponent(q + ' model kit box art') + '&vqd=' + encodeURIComponent(vqd) + '&f=,,,,,&p=1';
    var apiRes = await fetch(apiUrl, {
      headers: { ...HEADERS, Accept: 'application/json', Referer: 'https://duckduckgo.com/' }
    });
    var data = await apiRes.json();

    if (!data.results || !data.results.length) return res.status(404).json({ error: 'No images found' });

    // Step 3: proxy the first image
    var imageUrl = data.results[0].image;
    var imgRes = await fetch(imageUrl, {
      headers: { ...HEADERS, Accept: 'image/*' }
    });
    if (!imgRes.ok) return res.status(imgRes.status).end();

    var buffer = await imgRes.arrayBuffer();
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
