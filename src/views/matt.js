import { callClaude }  from '../api.js';
import { INVENTORY }   from '../data/inventory.js';
import { esc, fmt }    from '../utils.js';
import { getStashKits } from './collection.js';

var history = [];

function buildSystemPrompt() {
  var stash = getStashKits();
  return `You are Matt Varnish — a knowledgeable, opinionated, and friendly scale modelling companion. You help with every aspect of the hobby: painting and weathering techniques, kit research and reviews, tools and materials, builds, decals, washes, chipping, masking, primers, basing, references — everything.

You know the user's full paint inventory and kit stash (below). Use this context naturally — if they ask what to build next or what paints they'd need, you already know what they have.

PERSONALITY: Like a mate who's been modelling for 20 years. Direct, practical, occasionally opinionated. You have preferences (Tamiya acrylics are hard to beat, Vallejo air straight from the bottle, Mr Surfacer for primer) but you're not dogmatic. You enjoy the hobby and it shows.

RULES:
1. Cover all aspects of modelling — not just paints.
2. When paint is relevant, lead with Tamiya acrylics as the preferred range.
3. NEVER claim the user owns a paint not listed in their inventory.
4. If asked about a kit they own, refer to it by name from their stash.
5. Be concise — 2 to 4 sentences unless detail is genuinely needed. No waffle.
6. You have web search. Use it for kit reviews, technique lookups, or checking codes/equivalents. Don't mention searching — just give the answer.

FORMAT: Conversational plain text. **Bold** for paint codes, kit names, or key terms. No bullet lists unless comparing multiple options.

USER'S PAINT INVENTORY:
${JSON.stringify(INVENTORY)}

USER'S KIT STASH:
${stash.length ? JSON.stringify(stash.map(k => ({ name: k.name, brand: k.brand, scale: k.scale, type: k.type }))) : 'No kits in stash yet.'}`;
}

export function initMatt() {
  var input = document.getElementById('matt-input');
  var btn   = document.getElementById('matt-send-btn');

  btn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', function () { autoResize(input); });
}

async function sendMessage() {
  var input = document.getElementById('matt-input');
  var text  = input.value.trim();
  if (!text) return;

  var btn = document.getElementById('matt-send-btn');
  btn.disabled = true;
  input.value  = '';
  input.style.height = 'auto';

  appendMessage('user', text);
  history.push({ role: 'user', content: text });
  var thinking = appendThinking();
  scrollChat();

  try {
    var data  = await callClaude(history, buildSystemPrompt(), {
      tools:     [{ type: 'web_search_20250305', name: 'web_search' }],
      maxTokens: 500,
    });
    var reply = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    thinking.remove();
    history.push({ role: 'assistant', content: data.content });
    appendMessage('assistant', reply);
  } catch (err) {
    thinking.remove();
    appendMessage('assistant', `**Error:** ${esc(err.message)}`);
  }

  btn.disabled = false;
  scrollChat();
}

function appendMessage(role, text) {
  var chat = document.getElementById('matt-chat');
  var row  = document.createElement('div');
  row.className = `message-row ${role}`;
  row.innerHTML = `<div class="bubble">${fmt(text)}</div>`;
  chat.appendChild(row);
}

function appendThinking() {
  var chat = document.getElementById('matt-chat');
  var row  = document.createElement('div');
  row.className = 'typing-row';
  row.innerHTML = '<div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  chat.appendChild(row);
  return row;
}

function scrollChat() {
  var c = document.getElementById('matt-chat');
  c.scrollTop = c.scrollHeight;
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
