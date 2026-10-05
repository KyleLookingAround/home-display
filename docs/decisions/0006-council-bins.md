# 0006: Bin days from Stockport Council, through a daily GitHub Action

**Status:** accepted, October 2026

**Context.** Kyle asked whether bins could come from an API rather than being typed in. Stockport Council has no API. Its bin collections page for an address, `myaccount.stockport.gov.uk/bin-collections/show/<UPRN>`, lists the next date for each bin. But the page only allows browser calls from stockport.gov.uk, and there's no home server ([0004](0004-no-home-server.md)).

**Decision.** Fetch it in GitHub Actions instead.
- The Pages workflow runs every morning on a schedule, as well as on pushes.
- On the scheduled run it skips the tests and runs `scripts/bins.mjs`. The script reads the page for the UPRN in the `STOCKPORT_UPRN` secret and publishes `bins.json` (the source, when it was fetched, and each bin's name, colour, contents and next date) with the site.
- The display uses those dates while the feed is under four days old. Otherwise it uses bins set by hand.

**Consequences.**
- The address never appears in the repository or the site; only the dates do.
- The council's page carries bank holiday changes, which the hand-entered repeat can't.
- If the council changes its page layout, the script finds no collections. It then warns in the workflow log and publishes nothing new, so screens fall back after four days. `tests/fixtures/stockport-bins.html` is the layout the parser expects.
- The council's firewall turns away requests that don't look like a browser, so the script sends a browser-like user agent.
- GitHub pauses scheduled workflows in public repositories after 60 days without a commit.
