# 0017: A Weather view on the wall display

**Status:** accepted, October 2026.

**Context.** The TV showed the weather only as a corner of Today (the temperature, the sky, the day's high and low) and in the cockpit's dashboard. The phone's Home page had the full picture (rain soon, air, UV, pollen, the radar), and the TV had nothing like it. Kyle asked for a page with the weather on the TV.

**Decision.**
- **A seventh view, Weather, on key 7**, after Music, so the keys people already use stay where they are. It's in the rotation with Today, Energy and Travel, and the phone's Screen page and the setup links list it, as they list every view (`MODES`).
- **The answer first**, as every view does: is it raining, will it, and what to wear (`weatherVerdict`, `wearFor` in `household.js`). The quarter-hour rain decides "Raining now" and when it stops; the hourly forecast decides "Rain from 15:00" for the rest of the day.
- **Then the detail:**
  - now, with how warm it feels;
  - the sun;
  - the next 24 hours as a chart (`wxHoursSvg`: temperature coloured by warmth, the sky every three hours, the chance of rain as bars, the night shaded);
  - the week (`weekHtml`);
  - the rain radar (`radarHtml`, the phone's RainViewer frames over the same Esri map);
  - outside: wind, humidity, the day's rain, air, UV, pollen and flood warnings.
- **One forecast call, widened.** Open-Meteo's forecast now asks for seven days, hourly rain amounts, and the day's sky, rain and wind (`METEO_Q`). `parseWeather` keeps the 12 hours Today and the cockpit already use (`hours`) and adds 24 (`day`) and the week (`days`). The radar's frames are fetched only while the view shows (`SRC.radar`).
- **One row of toolbar.** With seven views and four buttons, the toolbar's buttons are tighter and two are shorter ("Wi-Fi", "Phone"; their full names stay for screen readers). `fitScreen` now starts from full size on every render, so text that shrank for one view grows back on the next.

**Consequences.**
- The forecast answer is larger (a week of hours), still one call every 15 minutes.
- The radar plays by changing which frame is shown once a second, resting on the latest. Nothing redraws when it moves, so it costs little on a TV.
- Tests: the verdict, the wind, what to wear and the week's parsing in `tests/display.test.mjs`; the view at 1080p, 720p, 16:10 and with a browser bar, and on a phone, in `tests/display.browser.mjs`.
