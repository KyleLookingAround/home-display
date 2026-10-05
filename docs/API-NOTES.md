# API notes

What the app calls, and how sure we are of each detail. Researched October 2026. **Unconfirmed** means it's taken from community code or an educated guess rather than official documentation.

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
- **CORS: unconfirmed.** Browser projects found online route through a Cloudflare Worker. Test with `fetch('https://api.octopus.energy/v1/products/')` in a browser console.

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
