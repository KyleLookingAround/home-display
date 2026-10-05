# 0006: Bin days from the council's calendar, checked weekly with Stockport Council

**Status:** accepted, October 2026

**Context.** Kyle asked whether bins could come from an API rather than being typed in. Stockport Council has no API. Its bin collections page for an address, `myaccount.stockport.gov.uk/bin-collections/show/<UPRN>`, lists the next date for each bin. But the page only allows browser calls from stockport.gov.uk, and there's no home server ([0004](0004-no-home-server.md)).

**Decision.**
- **The repeats are the base.** They come from the council's printed calendar, in `household.json`: green weekly, black fortnightly, blue and brown every four weeks, all on Fridays. They need nothing else to work.
- **A weekly check moves them on.** Kyle preferred weekly to daily, since bins don't change daily. The Pages workflow also runs every Saturday morning, after Friday's collection. On that run it skips the tests and runs `scripts/bins.mjs`, which reads the page for the UPRN in the `STOCKPORT_UPRN` secret. It publishes `bins.json` with the site: the source, when it was fetched, and each bin's name, colour, contents and next date.
- **Merging:** while the feed is under ten days old, `mergeBins` restarts each bin's repeat from the council's date for it. A council bin with no matching repeat is shown once.

**Consequences.**
- The address never appears in the repository or the site; only the dates do.
- The council's page carries bank holiday changes, which the repeats alone can't.
- The bin day and repeats are public in `household.json`; the address isn't.
- If the council changes its page layout, the script finds no collections. It then warns in the workflow log and publishes nothing new, so screens carry on with the repeats. `tests/fixtures/stockport-bins.html` is the layout the parser expects.
- The council's firewall turns away requests that don't look like a browser, so the script sends a browser-like user agent.
- GitHub pauses scheduled workflows in public repositories after 60 days without a commit.
