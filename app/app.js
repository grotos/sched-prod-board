import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000;

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('.status');

const rows = new Map();
const acked = new Map();

// R5: the viewer's own zone and date order; en-GB, de-DE, … give dd/mm, en-US gives mm/dd.
const timeFormat = new Intl.DateTimeFormat(navigator.languages?.length ? navigator.languages : undefined, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function localTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : timeFormat.format(d);
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function ackedMark(reply) {
  return el('span', { 'data-testid': 'acked', class: 'acked' }, `acked ${localTime(reply.ackedAt)}`);
}

function buildRow(i) {
  const li = el('li', { 'data-testid': 'incident-row', 'data-id': i.id, class: `row ${i.severity}` });
  li.append(
    el('span', { class: 'id' }, i.id),
    el('span', { class: 'sev' }, i.severity),
    el('span', { class: 'what' }, `${i.service} · ${i.region} · ${i.summary}`),
    el('time', { datetime: i.openedAt, title: i.openedAt }, localTime(i.openedAt)),
  );
  const slot = el('span', { class: 'take' });
  if (acked.has(i.id)) {
    slot.append(ackedMark(acked.get(i.id)));
  } else {
    const button = el('button', { type: 'button', 'data-testid': 'ack' }, 'Ack');
    button.addEventListener('click', () => onAck(i.id, button, slot));
    slot.append(button);
  }
  li.append(slot);
  return li;
}

async function onAck(id, button, slot) {
  button.disabled = true;
  button.textContent = 'Acking…';
  try {
    const reply = await ack(id);
    acked.set(id, reply);
    slot.replaceChildren(ackedMark(reply));
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.textContent = 'Ack';
    showStatus(`Ack failed for ${id}. Try again.`);
  }
}

// R1: keyed update, so rows that are already on screen (and their Ack buttons) stay put.
function render(incidents) {
  const sorted = [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const seen = new Set();
  let prev = null;
  for (const i of sorted) {
    seen.add(i.id);
    let row = rows.get(i.id);
    if (!row) {
      row = buildRow(i);
      rows.set(i.id, row);
      if (loaded) row.classList.add('new');
    }
    const want = prev ? prev.nextSibling : list.firstChild;
    if (row !== want) list.insertBefore(row, want);
    prev = row;
  }
  for (const [id, row] of rows) {
    if (!seen.has(id)) {
      row.remove();
      rows.delete(id);
    }
  }
  empty.hidden = sorted.length > 0;
  list.hidden = sorted.length === 0;
}

function showStatus(text) {
  status.textContent = text;
  status.hidden = !text;
}

let loaded = false;

async function refresh() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    if (!loaded) {
      loaded = true;
      loader.remove();
      board.setAttribute('aria-busy', 'false');
    }
    showStatus('');
  } catch (err) {
    console.error(err);
    showStatus(loaded ? 'Connection lost. Retrying…' : 'Could not load incidents. Retrying…');
  } finally {
    // R4: next refresh 2 s after this one ends, so slow answers never overlap.
    setTimeout(refresh, REFRESH_MS);
  }
}

refresh();
