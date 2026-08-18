# ADH Covid Observer

Tracks rising and falling rates of new COVID-19 cases across Africa. Live at
[covidobserver.africadatahub.org](https://covidobserver.africadatahub.org).

A React app bundled with Parcel and deployed on Netlify. The COVID data it displays
ships with it as static JSON — there is no API call at runtime.

---

## Getting started

Requires **Node 18 or newer** and **yarn** (a `yarn.lock` is committed and Netlify
installs with it, so prefer yarn over npm to avoid churning the lockfile).

```
yarn
yarn dev
```

Then open **http://localhost:1234** — Parcel's default port.

The first build takes 25–35 seconds because the whole dataset goes through the module
graph. Later rebuilds are incremental.

```
yarn build      # production build into dist/
```

### Environment

No API key is needed. The only variable is `ACDC_PASS`, the password gating the Africa
CDC view; without it that view cannot be unlocked. Put it in `.env` at the project
root:

```
ACDC_PASS=<password>
```

It is compiled into the JavaScript bundle, so anyone can read it in the deployed
source. It keeps an unfinished view out of the way; it is not a security boundary.

> If Netlify still has `CKAN` and `CKANDEV` environment variables, they are dead and
> can be deleted. See [Why the data is bundled](#why-the-data-is-bundled).

### URL modes

| URL | Effect |
| --- | --- |
| `/` | the OWID dataset |
| `/?acdc` | the Africa CDC dataset, behind the `ACDC_PASS` prompt |
| `/?embed` | hides the header and the page title, for iframing |

`?embed` pairs with [pym.js](https://pym.nprapps.org), loaded in `src/index.html`, so
the host page can size the iframe to the content.

---

## Layout

```
src/
  app.jsx                 root component: loads the case table, owns the timeline
  app.scss                styles; imports Bootstrap 5.1 and Work Sans
  index.html              entry, GTM + Userback + pym.js snippets
  components/
    CaseMap.jsx           Leaflet choropleth
    Leaderboard.jsx       ranked country list
    LeaderboardItem.jsx   one row, with a 14-point sparkline
    CountryData.jsx       per-country detail panel and charts
    CovidDataTable.jsx    country x date table, with CSV download
    Header.jsx            site header, hidden when embedded
  data/
    bundle.js             READ LAYER for the bundled data
    bundled/              GENERATED dataset - do not hand-edit
    countries.json        the 55 countries offered in the UI
    texts.json            per-dataset copy (keys: owid, acdc)
    definitions.json      per-dataset metric definitions (keys: owid, acdc)
    owid_fields.js        which metrics the data table's dropdown offers
    geojson/africa.js     country outlines for the map
  utils/Gradient.js       maps a value to a choropleth colour
scripts/
  build-data.js           regenerates src/data/bundled/ from data-source/*.csv
data-source/              raw CKAN CSV exports (gitignored) + how to re-export them
```

---

## The data

### What is in it

| | OWID | Africa CDC |
| --- | --- | --- |
| Case rows | 45,358 | 47,034 |
| Countries | 56 | 54 |
| Date span | 2020-02-07 → 2022-06-21 | 2020-02-15 → 2022-07-05 |
| Metrics available to the data table | 65 | 26 |

It is **frozen**. The source tables stopped being updated in mid-2022, so this is the
full extent of the data and `scripts/build-data.js` normally never needs to run again.

The Africa CDC country table has 29 columns against OWID's 68. It has no
reproduction-rate, stringency-index or cumulative vaccination columns — only
`new_people_vaccinated_smoothed` — so 12 of the data table's dropdown entries come back
empty for that dataset. That predates the bundling: the source table never had those
columns.

### How it is stored

`src/data/bundle.js` is the only thing that reads the bundle. It returns records shaped
exactly like the CKAN datastore rows they replaced — same field names, same
`YYYY-MM-DDT00:00:00` dates — so the components did not change how they read data.

| Function | Reads | Cost |
| --- | --- | --- |
| `loadCases(dataset)` | `<ds>-cases.json` | **~160 KB gz**, once on startup |
| `loadCountry(dataset, iso)` | `<ds>-country/<ISO>.json` | ~21 KB gz median, 64 KB worst |
| `loadMetricRange(dataset, metric, isoCodes, from, to)` | `<ds>-metric/<name>.json` | ~8 KB gz median, 122 KB worst |
| `countryDateRange(dataset)` | `index.json` | already loaded |

The two access patterns need opposite layouts: the country panel wants every metric for
one country, the data table wants one metric for every country. Storing both duplicates
the country table, which is about half the 39 MB on disk, but it saves the data table
from fetching 56 files — it starts with every country selected.

Everything is reached through `import()` calls in the generated `bundled/manifest.js`,
**not** `fetch()`. Parcel's dev server only serves what is in the module graph and
answers anything else with `index.html`, so a fetch-based design would work in
production and fail silently in development. Each file becomes its own lazy chunk, so
opening one country downloads one country.

Startup went from ~899 KB gzipped to ~160 KB, because the app previously pulled the
entire case table into the browser in 32,000-row pages — CKAN's per-response cap —
before it could draw anything.

### What is derived rather than stored

Two things, which together roughly halve the bundle:

- **`case_history`** is exactly the trailing 14 values of
  `new_cases_smoothed_per_million`, so it is rebuilt on load. This was checked against
  all 92,392 source rows before the column was dropped. It was over half the weight of
  the case table, since every row repeated 14 values already present in its neighbours.
- **Dates** are contiguous daily per country, so each series stores a start date and a
  length. Where a day is genuinely missing — one per country in the Africa CDC tables —
  it is listed in a `gaps` array.

Values are rounded to **3 decimals**. The OWID tables already are at source; the Africa
CDC tables carried full float precision from their rate divisions
(`0.0284663478948096`), and matching OWID halved them. Three decimals on a per-million
rate is one part per billion, and the UI rounds to whole numbers for the map and
leaderboard.

### Gotchas

- **Missing values are `null`, not the string `'NaN'`** that CKAN used to return.
  Anything sorting on a metric must filter them: lodash sorts `null` *above* numbers on
  a descending sort, which put the no-data countries at the top of the leaderboard until
  `app.jsx` was changed to run its first render through `orderData`. `orderData` filters
  them for the leaderboard; `orderMapData` keeps them so the map can draw those
  countries grey.
- `src/data/bundled/` is generated. Edit `scripts/build-data.js` and re-run it instead.
- `owid_fields.js` drives the data table's dropdown. Adding an entry that has no metric
  file gives an empty table rather than an error.

### Regenerating

Only needed if the source tables change.

1. Export the four CKAN resources as CSV into `data-source/`. The resource ids and the
   download procedure are in [data-source/README.md](data-source/README.md). They are
   private resources, so you must be logged in to the portal.
2. Run it:

```
node scripts/build-data.js
```

It reports row counts, date ranges and payload sizes per dataset, and refuses to write
a partial bundle if an input is missing or its header is not what the script expects.
The raw CSVs are gitignored; the generated bundle is committed.

---

## Why the data is bundled

The app used to read four CKAN datastore resources from `ckan.africadatahub.org` on
every page load. That broke in two independent ways:

1. It defaulted to `env: 'dev'`, pointing at `ckandev.africadatahub.org`, which **no
   longer resolves in DNS**. That default had been in place since June 2022 (`7be5831`)
   and only ever worked because the dev host was alive.
2. The portal upgraded to **CKAN 2.11**, which removed the API-key authentication the
   app used (dropped in 2.10). The keys in the Netlify environment are legacy UUID API
   keys, so every request authenticated as nobody and came back `403`. All four
   resources are also private. A CKAN API *token* would be needed, not a key.

Separately, `datastore_search_sql` on that host returns a 500 roughly half the time
(measured 5 successes in 10; plain `datastore_search` was 10 for 10). The old code used
the SQL endpoint in three places, so it would have been unreliable even with working
credentials.

Since the data had stopped updating anyway, bundling it removed all three failure modes
at once and made startup several times faster. Don't reintroduce the CKAN calls.

---

## Build notes

`terser` is pinned to `5.31.6` via both `resolutions` and `overrides`. Parcel otherwise
resolves `terser@5.7.1`, which depends on `source-map@0.7.3`; that version decides it is
in a browser whenever a global `fetch` exists and then refuses to load `mappings.wasm`.
Node 18 added a global `fetch`, so `parcel build` fails in the terser optimizer on any
current Node. `terser@5.16+` replaced that dependency with `@jridgewell/source-map`.
Removing the pin breaks the production build.

`app.scss` imports `nouislider/distribute/nouislider.css`, a package that is not a
declared dependency — it resolves only because `nouislider-react` depends on it and yarn
hoists it. It works, but declaring `nouislider` explicitly would make it robust.
