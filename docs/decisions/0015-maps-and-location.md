# 0015: Maps, location and distance

**Status:** accepted, October 2026. Stages 1 (the journey map), 2 (walk times from where you are, work noticed) and 3 (the way home on the TV) built; "get me home" follows.

**Context.** Kyle asked for something cool with maps, location and distance, and picked four: a live journey map, walk times from where the phone is, his way home shown on the TV, and getting home from anywhere with commute stats. There is no home server ([0004](0004-no-home-server.md)), the repository is public and names the street, and the commute already says when the house is empty, so it never goes in `household.json`.

**Decision.**
- **Where a train is, from its live times.** Darwin's public boards (Huxley2 and its mirror) give each service's details by the id on the departure board: actual times at the stops it has passed and expected times ahead (checked: both allow browser calls). `trainAt` places the train between the last stop it reached and the next, as a fraction of the time between them, and never past 95% of the way until the next stop reports. It's a good guess, not GPS.
- **Station places from an open list.** `public/stations.json` is davwheat/uk-railway-stations (from Trainline EU's stations), trimmed to code, name and place: about 2,600 stations, 100 kB, loaded only by pages that draw a map. It's under the Open Database License: the file says so and where it's from, and the map credits OpenStreetMap and CARTO.
- **Our own map from CARTO's dark tiles.** The same tiles as the rain radar, without labels, with the route, stations, home and the train drawn on top as SVG (`fitView`, `viewTiles`, `onView` in `geo.js`). No map library: the TV parses it, and it matches the look.
- **The train that matters, followed.** Going in, the one that gets you in for your start; going home, the first once you finish; on other days, the next you can make. Once it has left, it's followed until it gets you there, rather than jumping to the next departure.
- **Location stays on the phone, and goes to the TV sealed.** The phone's position is only asked for when Kyle turns it on (Settings, Location), at most once a minute while a page is open, and kept in memory. Work's place is kept on the phone; what the TV gets is the walk from the station, with the office days, sealed with the site PIN like the guest Wi-Fi. The walk to the train comes from the position only within 3 km of the station (further, you're not walking), and work is noticed within 250 m (or the fix's accuracy, up to 500 m), between 06:00 and 20:00, and only ever adds an office day.

- **The TV follows the train, not the phone.** Phones stop running pages in a pocket, so the phone tells the TV which train you're on (and where you are, if it knows) and the TV follows that train from its live times by itself, until a quarter of an hour after you'd be home.

**Consequences.**
- The train's place is interpolated: a train stuck between stations shows as nearly at the next one until that stop reports.
- Home on the map is the rounded point in `format.js` (`HOME`), not the house.
- The station list is a snapshot: a new station needs the file refreshed.
- Tests: the maths in `display.test.mjs` (distances, views, both boards' service details, where a train is) and a browser test of the map on the phone, Now and the TV against a pretend Darwin.
