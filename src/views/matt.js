import { callClaude }              from '../api.js';
import { INVENTORY }               from '../data/inventory.js';
import { esc, fmt }                from '../utils.js';
import { getStashKits, onKitChange } from './collection.js';
import { getPendingAttachment, clearPendingAttachment, attachmentContentBlock } from '../attachment.js';

var sessionHistory = [];
var _db     = null;
var _uid    = null;
var _chatId = null;

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

async function syncStash() {
  if (!_chatId) return;
  var stash = getStashKits().map(k => ({ name: k.name, brand: k.brand, scale: k.scale, type: k.type }));
  try {
    await fetch('/api/stash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: _chatId, stash }),
    });
  } catch (e) {
    console.warn('Matt: stash sync failed', e);
  }
}

export async function initMatt(db, uid) {
  _db  = db;
  _uid = uid;

  if (_db && _uid) {
    try {
      var doc = await _db.collection('users').doc(_uid).get();
      if (doc.exists) _chatId = doc.data().telegramChatId || null;
    } catch (e) {
      console.warn('Matt: could not load link status', e);
    }
  }

  onKitChange(syncStash);
  syncStash();
  updateLinkStatus();
  // Input wiring is handled by main.js (shared input bar)
}

export function getMattChatId() { return _chatId; }

export async function linkMatt(chatId) {
  _chatId = chatId;
  if (_db && _uid) {
    await _db.collection('users').doc(_uid).set({ telegramChatId: chatId }, { merge: true });
  }
  syncStash();
  updateLinkStatus();
}

export async function unlinkMatt() {
  _chatId = null;
  if (_db && _uid) {
    await _db.collection('users').doc(_uid).update({ telegramChatId: null });
  }
  updateLinkStatus();
}

function updateLinkStatus() {
  var form   = document.getElementById('matt-link-form');
  var linked = document.getElementById('matt-linked');
  var sub    = document.getElementById('matt-sub');
  if (!form || !linked) return;
  form.style.display   = _chatId ? 'none'  : 'block';
  linked.style.display = _chatId ? 'block' : 'none';
  if (sub) sub.textContent = _chatId ? '🔗 Linked to Telegram' : 'Session only — link in Settings';
}

export async function sendMattMessage() {
  var input = document.getElementById('chat-input');
  var text  = input.value.trim();
  var att   = getPendingAttachment();
  if (!text && !att) return;

  var btn = document.getElementById('chat-send-btn');
  btn.disabled = true;
  input.value  = '';
  input.style.height = 'auto';
  clearPendingAttachment();

  appendMessage('user', text, att);
  var thinking = appendThinking();
  scrollChat();

  try {
    var reply;

    // Attachments always go direct to the API (Telegram can't receive base64 images)
    if (_chatId && !att) {
      var res = await fetch('/api/matt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatId: _chatId, systemPrompt: buildSystemPrompt() }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      var data = await res.json();
      if (data.error) throw new Error(data.error);
      reply = data.reply;
    } else {
      var userContent;
      if (att) {
        userContent = [attachmentContentBlock(att)];
        if (text) userContent.push({ type: 'text', text });
      } else {
        userContent = text;
      }
      sessionHistory.push({ role: 'user', content: userContent });
      var data = await callClaude(sessionHistory, buildSystemPrompt(), {
        tools:     [{ type: 'web_search_20260209', name: 'web_search' }],
        maxTokens: 600,
      });
      reply = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      sessionHistory.push({ role: 'assistant', content: data.content });
    }

    thinking.remove();
    appendMessage('assistant', reply);
  } catch (err) {
    thinking.remove();
    appendMessage('assistant', `**Error:** ${esc(err.message)}`);
  }

  btn.disabled = false;
  scrollChat();
}

function appendMessage(role, text, att) {
  var chat = document.getElementById('matt-chat');
  var row  = document.createElement('div');
  row.className = `message-row ${role}`;
  var inner = '';
  if (att) {
    if (att.mediaType === 'application/pdf') {
      inner += `<div class="bubble-attachment pdf">📄 ${esc(att.name)}</div>`;
    } else if (att.data) {
      inner += `<img class="bubble-image" src="data:${att.mediaType};base64,${att.data}" alt="${esc(att.name)}">`;
    } else {
      inner += `<div class="bubble-attachment">🖼️ ${esc(att.name)}</div>`;
    }
  }
  if (text) inner += `<div class="bubble">${fmt(text)}</div>`;
  row.innerHTML = inner;
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

