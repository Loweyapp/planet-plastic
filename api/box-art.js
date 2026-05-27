export default async function handler(req, res) {
  var kitId = (req.query.id || '').replace(/\D/g, '');
  if (!kitId || kitId.length < 3) return res.status(400).end();

  var url = 'https://www.scalemates.com/products/img/' +
    kitId[0] + '/' + kitId[1] + '/' + kitId[2] + '/' + kitId + '-box.jpg';

  try {
    var response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.scalemates.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      }
    });

    if (!response.ok) return res.status(404).end();

    var buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 's-maxage=86400'); // cache 24h on Vercel CDN
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(502).end();
  }
}
