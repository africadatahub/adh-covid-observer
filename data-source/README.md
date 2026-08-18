# Raw CKAN exports

Drop the CSV exports here. `scripts/build-data.js` reads them and writes the bundled
dataset into `src/data/bundled/`. The CSVs themselves are gitignored — only the
generated bundle is committed.

## Which resources

These are the four datastore resources `src/app.jsx` reads. The main site only needs
the first two; the `acdc` pair is only used by the `?acdc` variant of the URL.

| Save as | Used for | Resource ID |
| --- | --- | --- |
| `owid-cases.csv` | map, leaderboard, timeline | `72da1306-e970-4398-9f1a-2a65beeb960e` |
| `owid-countries.csv` | country detail panel, data table | `0509abb8-fb51-4b4d-a9e9-90eb33cf2cdc` |
| `acdc-cases.csv` | same, for the acdc dataset | `1b16284b-8fbf-46c7-b940-99e7fdbb8a3e` |
| `acdc-countries.csv` | same, for the acdc dataset | `f283fdbb-cb46-427f-8fb8-0875c0e659f6` |

## How to export

All four are private, so you need to be logged in to the portal first —
https://ckan.africadatahub.org. Then, in the same browser:

```
https://ckan.africadatahub.org/datastore/dump/<resource-id>
```

That streams the whole table as CSV; your session cookie does the authenticating.
A 500 or a login page means the session isn't authenticated or the account lacks
access to that resource.

To confirm a resource is the one you think it is, hit this while logged in — it
returns JSON including `name` and the parent `package_id`:

```
https://ckan.africadatahub.org/api/3/action/resource_show?id=<resource-id>
```

To browse what your account can see, including private datasets:

```
https://ckan.africadatahub.org/dashboard/datasets
https://ckan.africadatahub.org/api/3/action/package_search?q=owid&include_private=true
```

## Sanity checks

- The **cases** files should have a narrow header with `date`, `iso_code`, `location`,
  `new_cases_smoothed`, `new_cases_smoothed_per_million` and `case_history`.
- The **countries** files should be the wide OWID table — 60+ columns, including
  `total_cases`, `people_fully_vaccinated`, `positive_rate` and `stringency_index`.
- Dates are expected in `YYYY-MM-DDT00:00:00` form; the app's date picker builds that
  string when it looks up a day.

If a file's header doesn't match, `scripts/build-data.js` reports what it found and
which expected columns are missing rather than writing a broken bundle.
