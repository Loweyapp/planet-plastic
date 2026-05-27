import { INVENTORY } from '../src/data/inventory.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');
  res.json(INVENTORY);
}
