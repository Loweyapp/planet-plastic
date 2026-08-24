// Upload a file to Anthropic's Files API and return a file_id.
// Accepts raw binary body — body parser must be disabled so we get the stream.
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filename, x-mime-type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  var apiKey = process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Collect raw bytes from request stream
  var chunks = [];
  for await (var chunk of req) chunks.push(chunk);
  var fileBuffer = Buffer.concat(chunks);

  if (!fileBuffer.length) return res.status(400).json({ error: 'Empty file' });

  var filename = req.headers['x-filename'] || 'document.pdf';
  var mimeType = req.headers['x-mime-type'] || req.headers['content-type'] || 'application/pdf';

  // Build multipart/form-data body manually
  var boundary = '----PlanetPlasticBoundary' + Date.now().toString(16);
  var partHead = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mimeType}`,
    '',
    '',
  ].join('\r\n');
  var partTail = `\r\n--${boundary}--\r\n`;

  var multipart = Buffer.concat([
    Buffer.from(partHead),
    fileBuffer,
    Buffer.from(partTail),
  ]);

  try {
    var resp = await fetch('https://api.anthropic.com/v1/files', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'files-api-2025-04-14',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipart,
    });

    var data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data.error?.message || `HTTP ${resp.status}` });
    res.json({ fileId: data.id, name: filename, mimeType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
