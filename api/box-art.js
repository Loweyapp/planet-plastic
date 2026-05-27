var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Referer': 'https://www.scalemates.com/',
  'Accept-Language': 'en-GB,en;q=0.9',
};

export default async function handler(req, res) {
  var kitUrl = req.query.url || '';
  if (!kitUrl.includes('scalemates.com')) return res.status(400).end();

  try {
    // Fetch the kit page and extract the og:image URL
    var pageRes = await fetch(kitUrl, { headers: { ...HEADERS, Accept: 'text/html' } });
    if (!pageRes.ok) return res.status(404).end();

    var html = await pageRes.text();
    var match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (!match) return res.status(404).end();

    var imgUrl = match[1];

    // Proxy the image
    var imgRes = await fetch(imgUrl, { headers: { ...HEADERS, Accept: 'image/*' } });
    if (!imgRes.ok) return res.status(404).end();

    var buffer = await imgRes.arrayBuffer();
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(502).end();
  }
}
