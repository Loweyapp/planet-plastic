var BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

export default async function handler(req, res) {
  // Two modes: ?imgUrl=<direct cdn url> or ?url=<scalemates kit page url>
  var imgUrl  = req.query.imgUrl || '';
  var kitUrl  = req.query.url    || '';

  if (!imgUrl && !kitUrl) return res.status(400).end();

  try {
    // If we have a direct image URL, proxy it straight
    if (imgUrl) {
      return await proxyImage(imgUrl, res);
    }

    // Otherwise fetch the kit page and extract og:image
    if (!kitUrl.includes('scalemates.com')) return res.status(400).end();

    var pageRes = await fetch(kitUrl, {
      headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', Referer: 'https://www.google.com/' }
    });

    if (!pageRes.ok) return res.status(pageRes.status).end();

    var html = await pageRes.text();
    var match = html.match(/<meta[^>]+property="og:image"\s+content="([^"]+)"/i) ||
                html.match(/<meta[^>]+content="([^"]+)"\s+property="og:image"/i) ||
                html.match(/og:image.*?content="([^"]+)"/i);

    if (!match) return res.status(404).end();

    await proxyImage(match[1], res);
  } catch (e) {
    res.status(502).end();
  }
}

async function proxyImage(url, res) {
  var imgRes = await fetch(url, {
    headers: { ...BROWSER_HEADERS, Accept: 'image/webp,image/apng,image/*,*/*;q=0.8', Referer: 'https://www.scalemates.com/' }
  });
  if (!imgRes.ok) { res.status(imgRes.status).end(); return; }
  var buffer = await imgRes.arrayBuffer();
  res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Cache-Control', 's-maxage=86400');
  res.send(Buffer.from(buffer));
}
