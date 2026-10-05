# API notes

What the dashboard and the display call, and how sure we are of each detail. Researched October 2026. **Unconfirmed** means it's taken from community code or an educated guess rather than official documentation.

## Octopus Energy REST: `https://api.octopus.energy/v1/`

Docs: https://docs.octopus.energy/rest/guides/endpoints/

- **Auth:** HTTP Basic, with the API key as the username and an empty password. Needed for account and consumption endpoints. Products and prices are public.
- **Account:** `/accounts/{A-XXXXXXXX}/` returns `properties[]` with `electricity_meter_points[]` (`mpan`, `meters[].serial_number`, `agreements[]` holding `tariff_code`, `valid_from` and `valid_to`) and `gas_meter_points[]` (`mprn`, …).
- **Consumption:** `/{electricity|gas}-meter-points/{id}/meters/{serial}/consumption/`
  - Query: `?period_from&period_to&page_size (max 25000)&order_by=period&group_by=day|week|month|quarter`
  - Gas units: SMETS2 meters report m³, SMETS1 meters report kWh.
- **Rates:** `/products/{product}/{electricity|gas}-tariffs/{tariff}/standard-unit-rates/`, plus `standing-charges/`, `day-unit-rates/` and `night-unit-rates/`.
  - Each row has `value_inc_vat`, `valid_from`, `valid_to` and `payment_method` (`DIRECT_DEBIT` or `NON_DIRECT_DEBIT`).
  - `page_size` max is 1500.
- **Codes:**
  - Tariff code: `E-1R-{PRODUCT}-{REGION}`, for example `E-1R-AGILE-24-10-01-G`. Region G is North West England.
  - Product from tariff: drop the first two parts and the last one.
- **Product prefixes** (match by prefix, because dates change on relaunch):

  | Tariff | Prefix |
  |---|---|
  | Agile | `AGILE-` |
  | Go | `GO-VAR-` |
  | Intelligent Go | `INTELLI-VAR-` |
  | Flux | `FLUX-IMPORT-` / `FLUX-EXPORT-` |
  | Cosy | `COSY-` |
  | Tracker | `SILVER-` |
  | Agile Outgoing | `AGILE-OUTGOING-` |
  | Outgoing | `OUTGOING-VAR-` |
  | Outgoing Fixed | `OUTGOING-FIX-` / `OUTGOING-PRIME-FIX-` |

- **Product list:** `/products/?brand=OCTOPUS_ENERGY&is_business=false`. A `direction` field (IMPORT/EXPORT) is **unconfirmed**.
- **CORS: allowed** (checked 5 October 2026). Responses carry `Access-Control-Allow-Origin: *`, and preflights allow the `Authorization` header for account, consumption and GraphQL calls, so the published site can call Octopus directly. The home server helper is still used when present.

## Octopus GraphQL: `POST https://api.octopus.energy/v1/graphql/`

Reference: https://developer.octopus.energy/graphql/reference/queries/ and the BottlecapDave Home Assistant integration.

- **Token:** `mutation { obtainKrakenToken(input:{APIKey:"…"}){ token } }`. Send it as `Authorization: JWT <token>`. It lasts about an hour.
- **Home Mini device:**
  ```
  account(accountNumber){ electricityAgreements(active:true){ meterPoint{ meters(includeInactive:false){ smartImportElectricityMeter{ deviceId } } } } }
  ```
- **Live telemetry:** `smartMeterTelemetry(deviceId, grouping: TEN_SECONDS|HALF_HOURLY, start, end){ readAt consumptionDelta demand }`.
  - `demand` is in W and `consumptionDelta` in Wh (both from community reports).
  - Other grouping values are **unconfirmed**.
  - The rate limit is about 100 calls an hour per user, shared with the Octopus app, so poll no faster than once a minute.
- **Saving Sessions (unconfirmed):**
  ```
  savingSessions{ events{ id startAt endAt rewardPerKwhInOctoPoints } account(accountNumber){ hasJoinedCampaign joinedEvents{ eventId rewardGivenInOctoPoints } } }
  ```
- **Octoplus points:** `loyaltyPointLedgers{ balanceCarriedForward }`. Treating the first entry as the latest balance is **unconfirmed**.

## Carbon Intensity (National Grid): `https://api.carbonintensity.org.uk`

- **Forecast:** `/regional/intensity/{fromISO}/fw48h/regionid/{id}`. Data is in `data.data[]`, each with `from`, `to`, `intensity.forecast` and `intensity.index`.
- **History:** `/regional/intensity/{from}/{to}/regionid/{id}`, at most 14 days per call.
- **Region ids** (Octopus letter → id): A 10, B 9, C 13, D 6, E 8, F 4, G 3, H 12, J 14, K 7, L 11, M 5, N 2, P 1.
- No key needed, and it allows browser calls.

## Open-Meteo

- **Call:** `https://api.open-meteo.com/v1/forecast?latitude=53.41&longitude=-2.16&daily=temperature_2m_mean&past_days=92&forecast_days=7&timezone=Europe%2FLondon`
- `past_days` goes up to 92. The response holds `daily.time[]` and `daily.temperature_2m_mean[]`.
- No key needed, for non-commercial use.
- **The display's call:** `forecast?latitude&longitude&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=Europe%2FLondon&wind_speed_unit=mph`.
  - Times come back as local time without an offset, such as `2026-10-05T14:00`.
  - `weather_code` uses WMO codes.
- Allows browser calls (`Access-Control-Allow-Origin: *`).

## PVGIS (EU JRC)

- **Call:** `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat&lon&peakpower&loss=14&angle&aspect&outputformat=json`
- `aspect` 0 is south and 180 is north. Monthly output is in `outputs.monthly.fixed[].E_m`.
- **No browser calls allowed**, so it needs the proxy. The app falls back to built-in Stockport estimates.

## EPC register

- The old `epc.opendatacommunities.org` API redirects to the new MHCLG service at https://get-energy-performance-data.communities.gov.uk/ (announced July 2026).
- The new API base is `https://api.get-energy-performance-data.communities.gov.uk/api/`, with `Authorization: Bearer <token>`.
- The search path `/domestic/search?postcode=` and its response shape are **unconfirmed**, and browser calls are unknown, so it goes through the proxy.

## Ofgem price cap

- **Change dates:** 1 Jan, 1 Apr, 1 Jul and 1 Oct, announced about five weeks before. The January 2027 cap is due in late November 2026.
- **Cap for 1 Oct – 31 Dec 2026** (GB average, Direct Debit, per Ofgem):
  - Electricity: 26.32p/kWh, standing charge 54.83p/day.
  - Gas: 7.97p/kWh, standing charge 29.68p/day.
  - Typical bill: £1,723 a year.
- Regional figures are in Ofgem's downloadable tables. The app shows the account's actual rates instead.

## Stockport Council bin collections (display: bins, daily in GitHub Actions)

- **No API.** The page is `https://myaccount.stockport.gov.uk/bin-collections/show/{UPRN}` (HTML).
- **Browser calls:** refused. `Access-Control-Allow-Origin` lists only stockport.gov.uk, so it's fetched by `scripts/bins.mjs` in GitHub Actions.
- **Firewall:** CloudFront answers 403 unless the request has a browser-like `User-Agent`.
- **Layout (checked 5 October 2026):**
  - One `<div class="service-item service-item-{colour}">` per bin.
  - Each holds `<h3>` (for example "Blue bin"), `<p class="sub-title">` (what goes in it) and a `<p>` with the date as "Thursday, 8 October 2026".
  - The parser is the same approach as the community project UKBinCollectionData.
- **Finding your UPRN:** it's the number at the end of the page address once you've looked up your bins.

## Huxley2 (display: trains, no server)

- **What it is:** a community JSON front end to National Rail's Darwin (OpenLDBWS) at `https://huxley2.azurewebsites.net`. No key needed, and it allows browser calls (`Access-Control-Allow-Origin: *`; checked 5 October 2026).
- **Departures:** `GET /departures/{CRS}/{rows}`, or `/departures/{CRS}/to/{CRS}/{rows}` to filter.
- **Response:**
  - `locationName` and `nrccMessages[].value` (HTML).
  - `trainServices[]`, each with:
    - `std` (`"HH:MM"`);
    - `etd`: `"On time"`, `"Delayed"`, `"Cancelled"` or `"HH:MM"`;
    - `platform`, `operator` and `isCancelled`;
    - `cancelReason` and `delayReason`;
    - `destination[].locationName` and `via`.
- **Times:** local, with no date. `boardTime()` puts them on the right day around midnight.
- **Staff board:** `GET /staffdepartures/{CRS}/{rows}` (and `/to/`) has the same shape, but `std` and `etd` are full local date-times (`"2026-10-05T17:19:00"`, `"2026-10-05T17:46:25"`), and `etd` is null when there's no estimate. `boardTime()` reads both forms.
- **Caution:** it's a free community service with no guarantee. On 5 October 2026 `/departures` returned 500 for every station while `/staffdepartures` still worked. `loadTrainsLive()` tries three boards in turn (`TRAIN_BOARDS`): Huxley2's `/departures`, the mirror `national-rail-api.davwheat.dev/departures` (same shape, also `Access-Control-Allow-Origin: *`), then Huxley2's `/staffdepartures`, each with ten seconds to answer, and starts with whichever answered last. If all fail and a home server holds a Realtime Trains token, it uses that. The display asks once a minute only while departures are on screen.

## Where the ISS is (display: screensaver, no server)

- **What it is:** `https://api.wheretheiss.at/v1/satellites/25544` gives the International Space Station's `latitude`, `longitude`, `altitude` (km), `velocity` (km/h) and `visibility` (`daylight` or `eclipsed`). No key; it allows browser calls (`Access-Control-Allow-Origin: *`).
- **Limit:** about one call a second. The display asks once a minute while the screensaver shows, and every ten minutes otherwise.
- **Use:** `issPass()` works out the distance from Stockport along the ground. Under 1,500 km counts as overhead, and the station passes the window with a billboard saying how far up it is.

## Realtime Trains (display: travel, through a server only)

- **The old API is gone.** `api.rtt.io` stopped on 30 September 2026 and now answers 418 with a pointer to the new one. `secure.realtimetrains.co.uk` follows on 31 March 2027.
- **New API:** `https://data.rtt.io`, with an OpenAPI spec at https://realtimetrains.github.io/api-specification. Sign up at https://api-portal.rtt.io.
- **Auth:** `Authorization: Bearer <token>`. You get either a long-life access token, or a refresh token swapped for short-life access tokens at `GET /api/get_access_token` (answers `{ token, validUntil }`).
- **Rule:** no token may be placed in a distributable user application; it must sit behind a server-side proxy, or it's revoked. So trains only come through `server.py`, which adds the token from `RTT_TOKEN` or `RTT_REFRESH_TOKEN`.
- **Rate limits:** 30 a minute, 750 an hour, 9,000 a day and 30,000 a week. The display asks once a minute in travel mode and every five minutes otherwise.
- **Departures:** `GET /gb-nr/location?code=SPT&filterTo=MAN&timeWindow=120`. It returns 204 when there are no services.
  - The response holds `query.location.description` (the station name) and `services[]`.
  - Each service has:
    - `temporalData.departure`: `scheduleAdvertised`, `realtimeForecast`, `realtimeActual`, `realtimeEstimate` and `isCancelled`, all ISO 8601 times;
    - `temporalData.displayAs`, such as `CANCELLED`;
    - `locationMetadata.platform`, with `planned` and `actual`;
    - `destination[].location.description`;
    - `scheduleMetadata.operator.name`.
  - Taken from the spec. The display hasn't yet been tried against a live token.

## TfGM Metrolink (display: travel)

- **Call:** `GET https://api.tfgm.com/odata/Metrolinks` with header `Ocp-Apim-Subscription-Key`. Get a key at https://developer.tfgm.com.
- **No browser calls:** a preflight is refused with 403, so trams come through `server.py`, which adds the key from `TFGM_KEY`.
- **Response (unconfirmed, from community code):** `value[]`, one row per platform display. The display groups rows by `StationLocation` (the stop name you set).
  - `StationLocation`, `Direction` and `MessageBoard`.
  - `Dest0`–`Dest3`, `Wait0`–`Wait3` (minutes, as strings), `Status0`–`Status3` and `Carriages0`–`Carriages3`.
  - Rows saying "Terminates Here" are left out.

## Calendars (display: home)

- **Source:** a calendar's secret iCal address. In Google Calendar it's under Settings → the calendar → Integrate calendar.
- **No browser calls:** Google's `calendar.google.com/calendar/ical/…` doesn't send CORS headers. With the helper present, the display fetches it through `/proxy/gcal/…`; the helper allows only `calendar/ical/` paths. Other providers are fetched directly and may or may not allow it.
- **Parsing:** done in `src/lib/household.js`. It handles:
  - folded lines and `TZID` times;
  - all-day events and `DURATION`;
  - `RRULE` with `FREQ` DAILY, WEEKLY (with `BYDAY`), MONTHLY (`BYDAY` like `2TU`, or `BYMONTHDAY`) and YEARLY, plus `INTERVAL`, `COUNT` and `UNTIL`;
  - `EXDATE`, moved instances (`RECURRENCE-ID`) and cancelled events.
- **Not handled:** rarer rules such as `BYSETPOS` and `BYWEEKNO`.

## The outdoors (no key; all allow browser calls, checked 5 October 2026)

- **Bank holidays:** `GET https://www.gov.uk/bank-holidays.json`. `england-and-wales.events[]` with `title` and `date` (`YYYY-MM-DD`). Fetched once a day.
- **Rain every quarter hour:** Open-Meteo `GET /v1/forecast?…&minutely_15=precipitation,precipitation_probability&forecast_minutely_15=12&past_minutely_15=1`. Local times like `2026-10-05T17:45`; rain counts from 0.1 mm in a quarter hour (`rainSoon`).
- **Rain radar:** RainViewer `GET https://api.rainviewer.com/public/weather-maps.json` gives `host` and `radar.past[]` frames (`time` in seconds, `path`). Tiles are `{host}{path}/256/{z}/{x}/{y}/2/1_1.png`; zoom 7 works, 8 returns an empty tile. The map underneath is CARTO's `dark_nolabels` (© OpenStreetMap contributors © CARTO).
- **Air quality, UV and pollen:** `GET https://air-quality-api.open-meteo.com/v1/air-quality?…&current=european_aqi,uv_index,grass_pollen,birch_pollen,alder_pollen&hourly=uv_index&forecast_days=1`. Pollen in grains per cubic metre, from CAMS; it's near zero outside the season.
- **Flood warnings:** Environment Agency `GET https://environment.data.gov.uk/flood-monitoring/id/floods?lat=…&long=…&dist=15`. `items[]` with `severityLevel` (1 severe warning, 2 warning, 3 alert, 4 no longer in force), `description`, `message`, `timeRaised`.
- **Grid mix:** National Grid `GET https://api.carbonintensity.org.uk/regional/regionid/3` (North West). `data[0].data[0].generationmix[]` with `fuel` and `perc`.
- **Not usable from a browser:** the Met Office's warnings feed (no `Access-Control-Allow-Origin`).

## ntfy.sh (the phone as a remote)

- `POST https://ntfy.sh/{topic}` with a body publishes it; `GET https://ntfy.sh/{topic}/sse` streams new messages as server-sent events, each `data:` a JSON object with `event: "message"` and the body in `message`. `?poll=1&since=all` reads what's cached (12 hours). No account; `Access-Control-Allow-Origin: *`.
- Topics are `hse-screen-<code>`, the code eight letters from a screen's settings. Anonymous use is rate limited (a few hundred messages a day), far above a remote's needs: the screen only answers when asked or when its view changes.

