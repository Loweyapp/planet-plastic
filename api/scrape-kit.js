export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var url = req.query.url || '';
  if (!url.includes('scalemates.com/kits/')) {
    return res.status(400).json({ error: 'Must be a scalemates.com/kits/ URL' });
  }

  // Always try to parse from URL first as a reliable base
  var fromUrl = parseFromUrl(url);

  // Then try fetching the page for richer data (scale, type)
  try {
    var response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      }
    });

    if (response.ok) {
      var html = await response.text();
      var fromHtml = parseFromHtml(html);
      // Merge: HTML wins where it has data, URL fills gaps
      return res.json({
        name:   fromHtml.name   || fromUrl.name,
        brand:  fromHtml.brand  || fromUrl.brand,
        scale:  fromHtml.scale  || '',
        kitNo:  fromHtml.kitNo  || fromUrl.kitNo,
        type:   fromHtml.type   || '',
      });
    }
  } catch (e) {
    // fall through to URL-only result
  }

  res.json(fromUrl);
}

function parseFromUrl(url) {
  // e.g. https://www.scalemates.com/kits/revell-04922-arado-ar-196-b--938400
  var slug = url.split('/kits/')[1] || '';
  slug = slug.split('--')[0]; // strip trailing --id

  // slug = "revell-04922-arado-ar-196-b"
  // First token = brand slug, then kit number (first all-digit token), then name
  var parts = slug.split('-');
  var brand = toTitleCase(parts[0]);

  // Find the kit number — first token that is purely alphanumeric with digits
  var kitNoIdx = parts.findIndex((p, i) => i > 0 && /^\d/.test(p));
  var kitNo = kitNoIdx !== -1 ? parts[kitNoIdx] : '';

  // Everything after the kit number is the name
  var nameStart = kitNoIdx !== -1 ? kitNoIdx + 1 : 1;
  var name = parts.slice(nameStart).map(toTitleCase).join(' ');

  return { name, brand, scale: '', kitNo, type: '' };
}

function parseFromHtml(html) {
  var name  = '';
  var brand = '';
  var scale = '';
  var kitNo = '';
  var type  = '';

  // Try og:title or <title>
  var ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  var title   = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  var raw     = (ogTitle ? ogTitle[1] : title ? title[1] : '').replace(' - Scalemates', '').trim();
  if (raw) name = raw;

  // Scale — look for "1/48", "1:48", "1/72" etc
  var scaleMatch = html.match(/\b(1[:/]\d{2,4})\b/);
  if (scaleMatch) scale = scaleMatch[1].replace(':', '/');

  // Brand — look for common patterns in page content
  var brandMatch = html.match(/manufacturer[^>]*>([^<]{2,40})<\//i) ||
                   html.match(/brand[^>]*>([^<]{2,40})<\//i);
  if (brandMatch) brand = brandMatch[1].trim();

  // Kit number
  var kitMatch = html.match(/kit\s*n(?:o|umber)[^>]*>([^<]{1,20})<\//i) ||
                 html.match(/product\s*code[^>]*>([^<]{1,20})<\//i);
  if (kitMatch) kitNo = kitMatch[1].trim();

  // Type / category
  var typeMatch = html.match(/category[^>]*>([^<]{2,40})<\//i) ||
                  html.match(/subject[^>]*>([^<]{2,40})<\//i);
  if (typeMatch) type = typeMatch[1].trim();

  return { name, brand, scale, kitNo, type };
}

function toTitleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
