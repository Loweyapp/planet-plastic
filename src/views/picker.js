import { callClaude }    from '../api.js';
import { getStashKits }  from './collection.js';
import { esc }           from '../utils.js';

var selections = { mood: null, genre: null, scale: null };

export function initPicker() {
  document.getElementById('chips-mood').addEventListener('click',  e => chipClick(e, 'mood'));
  document.getElementById('chips-genre').addEventListener('click', e => chipClick(e, 'genre'));
  document.getElementById('chips-scale').addEventListener('click', e => chipClick(e, 'scale'));
  document.getElementById('pick-btn').addEventListener('click', pickKit);
}

function chipClick(e, group) {
  var chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll(`#chips-${group} .chip`).forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  selections[group] = chip.textContent.trim();
  document.getElementById('pick-btn').disabled = !selections.mood;
}

async function pickKit() {
  var stash = getStashKits();
  if (!stash.length) {
    document.getElementById('kit-result').innerHTML =
      '<div class="no-stash-msg">No kits in your stash yet — import your Scalemates collection from the Collection tab first.</div>';
    return;
  }

  var btn = document.getElementById('pick-btn');
  btn.disabled = true;
  btn.textContent = 'Thinking…';
  document.getElementById('kit-result').innerHTML = '';

  var { mood, genre, scale } = selections;
  var list = stash.map(k => `${k.name} (${k.scale || '?'}, ${k.brand || 'Unknown'}, ${k.type || 'Unknown type'})`).join('\n');

  var prompt = `You are a scale modelling adviser helping pick the next kit to build.

Mood: ${mood}
Genre preference: ${genre || 'Any'}
Scale preference: ${scale || 'Any'}

Stash (${stash.length} kits):
${list}

Pick the single best kit from the stash for this mood and preferences. Return ONLY valid JSON:
{"name":"Full kit name","scale":"1:72","brand":"Tamiya","reason":"Why this suits the mood","difficulty":3,"paint_tip":"Key paint or technique tip","aftermarket":"Worthwhile aftermarket or none"}

difficulty is 1–5 (1=easy, 5=expert). JSON only, no other text.`;

  try {
    var data = await callClaude([{ role: 'user', content: prompt }], null, { maxTokens: 2000 });
    var raw  = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    raw = raw.replace(/<invoke[\s\S]*?<\/invoke>/g, '').trim();
    var m    = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in response');
    renderKitCard(JSON.parse(m[0]));
  } catch (err) {
    document.getElementById('kit-result').innerHTML =
      `<div class="no-stash-msg">Something went wrong: ${esc(err.message)}</div>`;
  }

  btn.disabled = false;
  btn.textContent = 'Pick a kit for me';
}

function renderKitCard(kit) {
  var pips = Array.from({ length: 5 }, (_, i) =>
    `<div class="pip ${i < kit.difficulty ? 'filled' : ''}"></div>`).join('');

  document.getElementById('kit-result').innerHTML = `
    <div class="kit-card">
      <div class="kit-card-name">${esc(kit.name)}</div>
      <div class="kit-card-meta">${esc(kit.scale || '')} · ${esc(kit.brand || '')}</div>
      <div class="kit-card-reason">${esc(kit.reason)}</div>
      ${kit.paint_tip ? `<div class="kit-card-row"><strong>Paint tip</strong> ${esc(kit.paint_tip)}</div>` : ''}
      ${kit.aftermarket && kit.aftermarket.toLowerCase() !== 'none'
        ? `<div class="kit-card-row"><strong>Aftermarket</strong> ${esc(kit.aftermarket)}</div>` : ''}
      <div class="difficulty-pips">${pips}</div>
    </div>`;
}
