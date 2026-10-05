# Harold Street Energy

A home energy dashboard for your Octopus account: usage, costs, Agile prices, grid carbon, tariff comparison, battery and solar simulators, and planning tools for the house.

## Two ways to run it

**Quick: open the file.** Double-click `index.html`. It opens with example data. Click **Connect account**, paste your Octopus account number and API key, and your own data loads. PVGIS solar data and the EPC search won't work this way, and some browsers may refuse the Octopus connection from a local file.

**Better: run it on your home server.**

1. Copy this whole folder to the server.
2. Run `python3 server.py` (Python 3.8+, nothing to install).
3. Open the address it prints, such as `http://192.168.1.20:8787`, on any device at home.
4. On your phone, use Add to Home Screen to install it like an app.

The helper only forwards requests to Octopus, PVGIS, the EPC register, National Grid's carbon API and Open-Meteo. Keep it on your home network and don't forward its port on your router.

To keep it running after you log out, add it as a service. For example, with systemd, create `/etc/systemd/system/harold-energy.service`:

```
[Unit]
Description=Harold Street Energy
After=network-online.target

[Service]
WorkingDirectory=/path/to/harold-street-energy-app
ExecStart=/usr/bin/python3 server.py
Restart=on-failure
User=youruser

[Install]
WantedBy=multi-user.target
```

Then run `sudo systemctl enable --now harold-energy`.

## Your data

Your API key, Direct Debit amount, change log, appliance figures and EPC notes are stored in the browser you use, not on the server. Each device needs connecting once. Download readings to CSV from the Home tab if you want a permanent record.

## What may need adjusting

These parts use Octopus features that aren't fully documented, so they're the most likely to need a tweak:

- Live readings from an Octopus Home Mini
- Saving Sessions and Octoplus points
- The EPC search (the government moved to a new data service in 2026)

If one of these shows an error, the rest of the dashboard keeps working.

## What's in the folder

| Path | What it is |
|---|---|
| `index.html` | The app. Built from `src/`; don't edit it directly. |
| `src/` | Source: styles, markup, data code, analysis, interface, starfield. |
| `build.py` | `python3 build.py` rebuilds `index.html` from `src/`. |
| `server.py` | Home server helper. |
| `tests/` | `node --test tests/analysis.test.mjs` checks the maths. |
| `CLAUDE.md` | Brief for a Claude Code session. |
| `ROADMAP.md` | Next steps: household display site, TV, password lock, Astro. |
| `docs/` | Stack options and API notes. |
| `manifest.webmanifest`, `icon-*.png` | For installing on a phone. |
