import { relativeTime } from '../lib/time';

/** Topic, region and search filters for the Today page. State lives in the URL so a view can be shared. */

const list = document.querySelector<HTMLElement>('[data-story-list]');
const cards = [...document.querySelectorAll<HTMLElement>('.card')];
const search = document.querySelector<HTMLInputElement>('#search');
const searchRow = document.querySelector<HTMLElement>('[data-search-row]');
const searchToggle = document.querySelector<HTMLButtonElement>('[data-search-toggle]');
const status = document.querySelector<HTMLElement>('[data-status]');
const empty = document.querySelector<HTMLElement>('[data-empty]');
const briefTopics = [...document.querySelectorAll<HTMLElement>('[data-brief] [data-topic]')];

type Filter = 'topic' | 'region';
const state = new URLSearchParams(location.search);

function current(name: Filter): string {
  return state.get(name) ?? 'all';
}

function apply(): void {
  const topic = current('topic');
  const region = current('region');
  const query = (state.get('q') ?? '').trim().toLowerCase();
  let shown = 0;

  for (const card of cards) {
    const match =
      (topic === 'all' || card.dataset.topic === topic) &&
      (region === 'all' || card.dataset.region === region) &&
      (!query || (card.dataset.search ?? '').includes(query));
    card.hidden = !match;
    if (match) shown++;
  }

  // The brief follows the topic filter only; region and search narrow the story list.
  for (const block of briefTopics) block.hidden = topic !== 'all' && block.dataset.topic !== topic;

  for (const chip of document.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
    chip.setAttribute('aria-pressed', String(current(chip.dataset.filter as Filter) === chip.value));
  }

  if (empty) empty.hidden = shown > 0 || cards.length === 0;
  if (status) status.textContent = `${shown} ${shown === 1 ? 'story' : 'stories'}`;
  list?.setAttribute('aria-busy', 'false');
}

function save(): void {
  const query = state.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

for (const chip of document.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
  chip.addEventListener('click', () => {
    const name = chip.dataset.filter as Filter;
    if (chip.value === 'all') state.delete(name);
    else state.set(name, chip.value);
    save();
    apply();
  });
}

if (search) {
  search.value = state.get('q') ?? '';
  if (search.value && searchRow) searchRow.hidden = false;
  search.addEventListener('input', () => {
    if (search.value.trim()) state.set('q', search.value);
    else state.delete('q');
    save();
    apply();
  });
}

searchToggle?.addEventListener('click', () => {
  if (!searchRow || !search) return;
  searchRow.hidden = !searchRow.hidden;
  searchToggle.setAttribute('aria-expanded', String(!searchRow.hidden));
  if (!searchRow.hidden) search.focus();
});

/** Keep "12 min ago" honest while the page stays open. */
function refreshTimes(): void {
  const now = new Date();
  for (const el of document.querySelectorAll<HTMLTimeElement>('time[data-relative]')) {
    el.textContent = relativeTime(el.dateTime, now);
  }
}

apply();
refreshTimes();
setInterval(refreshTimes, 60_000);
