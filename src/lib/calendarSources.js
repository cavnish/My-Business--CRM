import { addDays, todayISO } from './format.js';

const GLOBAL_OBSERVANCES = [
  { month: 1, day: 1, title: "New Year's Day", description: 'A widely observed start to the calendar year.' },
  { month: 2, day: 11, title: 'International Day of Women and Girls in Science', description: 'A United Nations observance promoting equal access to science.' },
  { month: 3, day: 8, title: "International Women's Day", description: 'A global day recognizing women and advancing equality.' },
  { month: 3, day: 20, title: 'International Day of Happiness', description: 'A United Nations day highlighting wellbeing and happiness.' },
  { month: 4, day: 7, title: 'World Health Day', description: 'World Health Organization observance focused on global health.' },
  { month: 4, day: 22, title: 'Earth Day', description: 'An international day promoting environmental protection.' },
  { month: 5, day: 1, title: 'International Workers’ Day', description: 'A day recognizing workers and the labour movement.' },
  { month: 5, day: 15, title: 'International Day of Families', description: 'A United Nations observance of families and communities.' },
  { month: 6, day: 5, title: 'World Environment Day', description: 'A United Nations observance for environmental action.' },
  { month: 6, day: 21, title: 'International Day of Yoga', description: 'A United Nations observance of yoga and wellbeing.' },
  { month: 7, day: 11, title: 'World Population Day', description: 'A United Nations observance focused on population issues.' },
  { month: 8, day: 12, title: 'International Youth Day', description: 'A United Nations observance celebrating young people.' },
  { month: 9, day: 21, title: 'International Day of Peace', description: 'A United Nations day dedicated to peace and non-violence.' },
  { month: 10, day: 24, title: 'United Nations Day', description: 'The anniversary of the entry into force of the UN Charter.' },
  { month: 11, day: 20, title: 'World Children’s Day', description: 'A United Nations day promoting children’s rights and wellbeing.' },
  { month: 12, day: 1, title: 'World AIDS Day', description: 'A global observance for awareness and support.' },
  { month: 12, day: 10, title: 'Human Rights Day', description: 'The annual observance of the Universal Declaration of Human Rights.' },
];

let inMemoryRefreshDate = '';

const toIsoDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const globalObservancesForYear = (year) => GLOBAL_OBSERVANCES.map(({ month, day, ...event }) => ({
  ...event,
  date: toIsoDate(year, month, day),
  category: 'Global observance',
  region: 'Worldwide',
  source: 'global-observance',
  source_attribution: 'Curated annual observance record. Verify against the relevant official observance page before publication.',
  verification_status: 'Curated',
  seed_key: `global-observance:${year}:${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
}));

export const fetchIndiaPublicHolidays = async (year, signal) => {
  const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`, { signal });
  if (response.status === 204) throw new Error('India holiday service returned no holiday data (HTTP 204).');
  if (!response.ok) throw new Error(`India holiday service returned ${response.status}.`);
  const body = await response.text();
  if (!body.trim()) throw new Error('India holiday service returned an empty response.');
  let holidays;
  try {
    holidays = JSON.parse(body);
  } catch {
    throw new Error('India holiday service returned unreadable data.');
  }
  if (!Array.isArray(holidays)) throw new Error('India holiday service returned unexpected data.');

  return holidays.map((holiday) => {
    const category = holiday.types?.includes('Public') ? 'Indian national day' : 'Festival';
    const holidayDate = String(holiday.date).slice(0, 10);
    const stableName = String(holiday.name || holiday.localName).toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      title: holiday.localName || holiday.name,
      date: holidayDate,
      category,
      region: 'India',
      description: [holiday.name, holiday.types?.length ? `Type: ${holiday.types.join(', ')}` : ''].filter(Boolean).join(' · '),
      source: 'nager-date',
      source_url: `https://date.nager.at/api/v3/PublicHolidays/${year}/IN`,
      source_attribution: 'Nager.Date public-holiday data',
      verification_status: 'Verified',
      country_code: 'IN',
      seed_key: `nager-date:IN:${holidayDate}:${stableName}`,
    };
  });
};

const wikimediaUrl = (month, day) => `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`;

const stableKey = (value) => String(value || '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 140);

const wikipediaPageUrl = (page) => page?.content_urls?.desktop?.page
  || (page?.titles?.normalized ? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.titles.normalized.replaceAll(' ', '_'))}` : null);

const categoryForWikimediaType = {
  events: 'Historical event',
  births: 'Birth anniversary',
  deaths: 'Death anniversary',
  holidays: 'International observance',
};

// The Wikimedia endpoint is fetched only for a selected date or an explicit
// refresh. Its response is cached as ordinary CalendarEvent records so an
// unavailable network never removes locally saved or manual events.
export const fetchWikimediaOnThisDay = async (date, signal) => {
  const match = String(date || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Choose a valid calendar date before loading historical facts.');
  const [, month, day] = match;
  const response = await fetch(wikimediaUrl(month, day), { signal });
  if (!response.ok) throw new Error(`Wikimedia historical facts are unavailable (HTTP ${response.status}).`);
  const payload = await response.json();
  const records = [];
  for (const type of Object.keys(categoryForWikimediaType)) {
    for (const item of Array.isArray(payload?.[type]) ? payload[type] : []) {
      const page = item.pages?.[0];
      const title = page?.titles?.normalized || page?.titles?.display || item.text;
      if (!title) continue;
      const historicalYear = Number.isInteger(Number(item.year)) ? Number(item.year) : null;
      const key = stableKey(page?.pageid || `${historicalYear || 'annual'}-${title}`);
      records.push({
        title,
        date,
        category: categoryForWikimediaType[type],
        description: item.text || null,
        historical_year: historicalYear,
        person_name: ['births', 'deaths'].includes(type) ? title : null,
        source: 'wikimedia-on-this-day',
        source_url: wikipediaPageUrl(page),
        source_attribution: 'Wikimedia contributors · On this day',
        verification_status: 'Verified',
        source_metadata: { wikimedia_type: type, page_id: page?.pageid || null },
        seed_key: `wikimedia-on-this-day:${month}-${day}:${type}:${key}`,
      });
    }
  }
  return records;
};

export const calendarRefreshDue = () => {
  if (inMemoryRefreshDate === todayISO()) return false;
  try {
    return globalThis.localStorage?.getItem('webofolio-calendar-refresh-date') !== todayISO();
  } catch {
    return inMemoryRefreshDate !== todayISO();
  }
};

export const markCalendarRefreshed = () => {
  inMemoryRefreshDate = todayISO();
  try {
    globalThis.localStorage?.setItem('webofolio-calendar-refresh-date', todayISO());
  } catch {
    return true;
  }
  return true;
};

export const eventPostTaskSeed = (event, companyId) =>
  `calendar-event-post:${event.seed_key || event.id}:${companyId}`;

export const eventPostTaskDueDate = (eventDate) => String(eventDate).slice(0, 10);

export const eventPostTaskTitle = (eventTitle) => `Greeting post: ${eventTitle}`;

export const startOfWeekISO = (date = todayISO()) => {
  const start = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  return addDays(-daysSinceMonday, start);
};

export const endOfWeekISO = (date = todayISO()) =>
  addDays(6, new Date(`${startOfWeekISO(date)}T12:00:00`));

export const isPostWorthyEvent = (event) =>
  event?.greeting_suitable === true
  || ['Festival', 'Indian national day', 'Global observance', 'International observance', 'Official holiday'].includes(event?.category);
