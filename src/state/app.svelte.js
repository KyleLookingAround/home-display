/*
 * The dashboard's shared state. Every island on a page imports this one object, so they all see the same account
 * data, prices and choices. Big data (readings, rates) is held raw, not deeply reactive, and replaced whole when it
 * changes; the period roll-up and the gas regression follow from it.
 */
import { buildModel, gasRegression } from '../lib/analysis.js';
import { store } from '../lib/browser.js';
import { unitPriceAt } from '../lib/octopus.js';
import { mergeBins, councilBins, nextCollections, countdowns } from '../lib/household.js';

class App {
  raw = $state.raw(null);                     // account data, or example data when no account is connected
  status = $state('loading');                 // loading | live | demo | err
  checkedAt = $state(0);                      // when the account data was fetched
  notice = $state.raw(null);                  // { kind: 'warn' | 'err', title, body }
  account = $state(null);                     // the connected account number
  proxy = $state(false);                      // running through the home server helper

  days = $state(+store.get('days') || 30);    // the period: 7, 30 or 90 days
  unit = $state('gbp');                       // the daily chart in £ or kWh
  region = $state(store.get('region') || 'G');
  gasUnit = $state(store.get('gasUnit') || 'm3');
  pay = $state(store.get('pay') || 'DIRECT_DEBIT');

  agileToday = $state.raw(null); agileErr = $state.raw(null);
  carbonFc = $state.raw(null); carbonErr = $state.raw(null);
  rewards = $state.raw(null);
  now = $state(Date.now());                   // ticks each minute, so "now" moves on a page left open

  house = $state.raw(null);                   // household settings: household.json, with this device's changes on top
  weather = $state.raw(null); weatherErr = $state.raw(null);
  trains = $state.raw(null); trainsErr = $state.raw(null);   // the trains, with the walk from where you are (where.svelte.js)
  trainsBase = $state.raw(null);              // as the board gave them
  here = $state.raw(null);                    // where this phone is, { lat, lon, acc, at }, when location is on
  events = $state.raw(null); eventsErr = $state.raw(null);
  council = $state.raw(null);                 // the council's bin dates, when the weekly check has published them
  live = $state.raw(null); liveErr = $state.raw(null); liveState = $state('');   // the Home Mini: '' | looking | none | on
  holidays = $state.raw(null);                // bank holidays, England and Wales
  nowcast = $state.raw(null);                 // rain every quarter hour for the next three hours
  radar = $state.raw(null);                   // the rain radar's frames
  air = $state.raw(null);                     // air quality, UV and pollen
  floods = $state.raw(null);                  // Environment Agency warnings within 15 km
  gridMix = $state.raw(null);                 // what the region's power is made of right now

  compare = $state.raw(null);                 // the tariff comparison, once run
  compareOpts = $state.raw(null);             // the tariffs it priced, which the battery simulator offers too

  changelog = $state(store.getJ('changelog', []));
  acts = $state(store.getJ('acts', {}));
  measures = $state(store.getJ('measures', []));
  epc = $state(store.getJ('epc', { cur: '', pot: '', notes: '' }));

  model = $derived(this.raw ? buildModel(this.raw, this.days) : null);
  reg = $derived(this.raw ? gasRegression(this.raw) : null);

  get demo(){ return !this.raw || !!this.raw.demo; }
  get bins(){ return this.house ? mergeBins(this.house.bins, councilBins(this.council, this.now)) : []; }
  get countdowns(){ return this.house ? countdowns({ dates: this.house.dates, holidays: this.holidays, events: this.events }, this.now) : null; }
  get collections(){ return this.house ? nextCollections(this.bins, this.now, this.holidays) : null; }
  get eRateNow(){ return this.raw ? unitPriceAt(this.raw.eSets, Date.now()) : null; }
  get gRateNow(){ return this.raw ? unitPriceAt(this.raw.gSets, Date.now()) : null; }
}

export const app = new App();

/** Keeps one of the household's own lists or choices on this device. */
export function keep(key){
  const v = $state.snapshot(app[key]);
  if (typeof v === 'object') store.setJ(key, v); else store.set(key, String(v));
}
