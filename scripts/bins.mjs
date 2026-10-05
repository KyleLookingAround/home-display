// Fetch the next bin collections for one Stockport address and write them as JSON for the display.
// Stockport Council has no API and its page only allows calls from stockport.gov.uk, so a browser can't read it;
// this runs once a week in GitHub Actions instead. The address is a UPRN held in the STOCKPORT_UPRN secret,
// so only the dates are published, never the address.
//   STOCKPORT_UPRN=... node scripts/bins.mjs _site/bins.json
import { writeFileSync } from 'node:fs';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const COLOURS = ['black', 'blue', 'brown', 'green', 'grey', 'purple', 'red', 'yellow'];
const text = s => s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();

/** The page's "Your next collections": one service-item per bin, with a name, what goes in it and a date. */
export function parseStockportBins(html){
  const bins = [];
  const items = String(html).split(/<div class="service-item\b/).slice(1);
  for (const item of items){
    const name = (/<h3>([\s\S]*?)<\/h3>/.exec(item) || [])[1];
    const what = (/<p class="sub-title">([\s\S]*?)<\/p>/.exec(item) || [])[1];
    const dateText = [...item.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => text(m[1])).find(t => /\d{4}/.test(t));
    const m = dateText && /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(dateText);
    if (!name || !m) continue;
    const month = MONTHS.indexOf(m[2].toLowerCase());
    if (month < 0) continue;
    const date = `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
    const colour = COLOURS.find(c => new RegExp(`\\b${c}\\b`, 'i').test(name) || new RegExp(`service-item-${c}\\b`).test(item)) || 'grey';
    bins.push({ name: text(name), what: what ? text(what) : '', colour, date });
  }
  return bins.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

async function main(){
  const uprn = (process.env.STOCKPORT_UPRN || '').trim(), out = process.argv[2] || 'bins.json';
  if (!uprn){ console.log('STOCKPORT_UPRN is not set, so no bins.json is published.'); return; }
  if (!/^\d{6,14}$/.test(uprn)) throw new Error('STOCKPORT_UPRN should be the number at the end of your bin collections page address.');
  // The council's firewall turns away requests that don't look like a browser.
  const res = await fetch(`https://myaccount.stockport.gov.uk/bin-collections/show/${uprn}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 home-display', Accept: 'text/html' }
  });
  if (!res.ok) throw new Error(`Stockport Council answered ${res.status}.`);
  const bins = parseStockportBins(await res.text());
  if (!bins.length) throw new Error('No collections found on the council page; its layout may have changed.');
  writeFileSync(out, JSON.stringify({ source: 'Stockport Council', fetched: new Date().toISOString(), bins }, null, 2) + '\n');
  console.log(`Wrote ${bins.length} collections to ${out}: ${bins.map(b => `${b.name} ${b.date}`).join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.log(`::warning::Bins not updated: ${e.message}`); });
