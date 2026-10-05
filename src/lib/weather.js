/* Open-Meteo: Stockport's daily mean temperature, the last three months and the week ahead. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
import { dayKey, HOME } from './format.js';
import { request } from './net.js';

export async function loadWeather(){
  const j = await request(`https://api.open-meteo.com/v1/forecast?latitude=${HOME.lat}&longitude=${HOME.lon}&daily=temperature_2m_mean&past_days=92&forecast_days=7&timezone=Europe%2FLondon`);
  const map = new Map(), today = dayKey(Date.now());
  ((j.daily && j.daily.time) || []).forEach((k, i) => { const v = j.daily.temperature_2m_mean[i]; if (v != null) map.set(k, { t: v, forecast: k >= today }); });
  return map;
}
