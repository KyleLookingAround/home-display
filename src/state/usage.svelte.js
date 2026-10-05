/* The Usage page's own state: whether to compare with the period before, and that period's roll-up. */
import { app } from './app.svelte.js';
import { store } from '../lib/browser.js';
import { buildModel } from '../lib/analysis.js';

class Compare {
  on = $state(store.get('compare') !== 'off');
  before = $derived(app.raw && app.model ? buildModel(app.raw, app.days, app.model.start) : null);
  save(){ store.set('compare', this.on ? 'on' : 'off'); }
}
export const compareOn = new Compare();
