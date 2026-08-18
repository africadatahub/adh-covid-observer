#!/usr/bin/env node
/*
 * Turns the raw CKAN CSV exports in data-source/ into the static bundle the app
 * reads at runtime, so nothing has to call CKAN. The data is frozen (the tables
 * end mid-2022), so this runs once and the output is committed.
 *
 *   node scripts/build-data.js
 *
 * Three shapes come out of it, matching how the components actually read data:
 *
 *   <ds>-cases.json           the map, leaderboard and timeline. Loaded on startup.
 *   <ds>-country/<ISO>.json   every metric for one country, for the country panel.
 *   <ds>-metric/<name>.json   one metric across all countries, for the data table.
 *
 * Two things are dropped and rebuilt on load rather than stored:
 *   - case_history, which is exactly the trailing 14 values of
 *     new_cases_smoothed_per_million (verified against all 92,392 source rows).
 *   - dates, which are contiguous daily per country, so a start date and a count
 *     are enough. Any gaps are listed explicitly.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data-source');
const OUT = path.join(ROOT, 'src', 'data', 'bundled');

// The four resources src/app.jsx reads, by the resource id they were exported under.
const RESOURCES = [
    { dataset: 'owid', kind: 'cases',     id: '72da1306-e970-4398-9f1a-2a65beeb960e' },
    { dataset: 'owid', kind: 'countries', id: '0509abb8-fb51-4b4d-a9e9-90eb33cf2cdc' },
    { dataset: 'acdc', kind: 'cases',     id: '1b16284b-8fbf-46c7-b940-99e7fdbb8a3e' },
    { dataset: 'acdc', kind: 'countries', id: 'f283fdbb-cb46-427f-8fb8-0875c0e659f6' }
];

// Columns that describe the country rather than the day. Stored once per country
// instead of repeated across every date.
const STATIC = new Set(['continent', 'location', 'population', 'population_density', 'median_age',
    'aged_65_older', 'aged_70_older', 'gdp_per_capita', 'extreme_poverty', 'cardiovasc_death_rate',
    'diabetes_prevalence', 'female_smokers', 'male_smokers', 'handwashing_facilities',
    'hospital_beds_per_thousand', 'life_expectancy', 'human_development_index', 'tests_units']);

const CASE_COLUMNS = ['new_cases_smoothed', 'new_cases_smoothed_per_million'];

function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let field = '', row = [], quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
            } else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const header = rows.shift();
    return { header, rows: rows.filter(r => r.length === header.length) };
}

/*
 * The owid tables are already rounded to 3 decimals at source; the acdc ones carry
 * full float precision from the rate divisions (0.0284663478948096). Rounding those
 * to match owid halves the acdc bundle and cannot show up in the UI, which rounds
 * to whole numbers for the map and leaderboard and charts the rest - 3 decimals on
 * a per-million rate is one part per billion.
 */
const DECIMALS = 3;

// CKAN writes absent numbers as NaN. Keep them as null so the app's existing
// `!= null` guards catch them, and keep genuine strings as strings.
function num(v) {
    if (v === '' || v === 'NaN' || v === 'nan' || v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return Number.isInteger(n) ? n : Number(n.toFixed(DECIMALS));
}

const day = 86400000;
const toISO = d => new Date(d).toISOString().slice(0, 10);

function dateSpan(sorted) {
    const start = sorted[0];
    const end = sorted[sorted.length - 1];
    const span = Math.round((Date.parse(end) - Date.parse(start)) / day) + 1;
    const gaps = [];
    if (span !== sorted.length) {
        const have = new Set(sorted);
        for (let t = Date.parse(start); t <= Date.parse(end); t += day) {
            const iso = toISO(t);
            if (!have.has(iso)) gaps.push(iso);
        }
    }
    return { start, n: sorted.length, ...(gaps.length ? { gaps } : {}) };
}

function write(file, obj) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const json = JSON.stringify(obj);
    fs.writeFileSync(file, json);
    return { raw: Buffer.byteLength(json), gz: zlib.gzipSync(json, { level: 9 }).length };
}

const kb = b => (b / 1024).toFixed(0) + ' KB';

function load(resource) {
    const file = path.join(SRC, resource.id + '.csv');
    if (!fs.existsSync(file)) {
        console.error(`  MISSING ${path.relative(ROOT, file)} - see data-source/README.md`);
        return null;
    }
    const { header, rows } = parseCSV(fs.readFileSync(file, 'utf8'));
    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });

    for (const required of ['date', 'iso_code', 'location']) {
        if (!(required in idx)) {
            console.error(`  ${resource.id}.csv has no '${required}' column. Header was: ${header.join(', ')}`);
            return null;
        }
    }
    if (resource.kind === 'cases') {
        const missing = CASE_COLUMNS.filter(c => !(c in idx));
        if (missing.length) {
            console.error(`  ${resource.id}.csv is missing ${missing.join(', ')} - is this the cases resource?`);
            return null;
        }
    }

    // Group by country, ordered by date.
    const byCountry = new Map();
    for (const r of rows) {
        const iso = r[idx.iso_code];
        if (!byCountry.has(iso)) byCountry.set(iso, []);
        byCountry.get(iso).push(r);
    }
    for (const rs of byCountry.values()) rs.sort((a, b) => a[idx.date] < b[idx.date] ? -1 : 1);

    const metrics = header.filter(h => h !== '_id' && h !== 'date' && h !== 'iso_code' && !STATIC.has(h));
    return { header, idx, byCountry, metrics, rows: rows.length };
}

function buildCases(ds, data) {
    const countries = {};
    for (const [iso, rs] of data.byCountry) {
        countries[iso] = {
            location: rs[0][data.idx.location],
            ...dateSpan(rs.map(r => r[data.idx.date].slice(0, 10))),
            s: rs.map(r => num(r[data.idx.new_cases_smoothed])),
            m: rs.map(r => num(r[data.idx.new_cases_smoothed_per_million]))
        };
    }
    const s = write(path.join(OUT, `${ds}-cases.json`), { dataset: ds, countries });
    console.log(`  ${ds}-cases.json                ${kb(s.raw).padStart(9)} raw  ${kb(s.gz).padStart(8)} gz   ${Object.keys(countries).length} countries`);
    return s;
}

function buildCountryFiles(ds, data) {
    let raw = 0, gz = 0, largest = 0;
    const written = [];
    for (const [iso, rs] of data.byCountry) {
        const statics = {};
        for (const c of data.header) if (STATIC.has(c)) statics[c] = num(rs[0][data.idx[c]]);
        const m = {};
        for (const metric of data.metrics) m[metric] = rs.map(r => num(r[data.idx[metric]]));
        const s = write(path.join(OUT, `${ds}-country`, `${iso}.json`), {
            iso_code: iso,
            ...dateSpan(rs.map(r => r[data.idx.date].slice(0, 10))),
            static: statics,
            m
        });
        raw += s.raw; gz += s.gz; largest = Math.max(largest, s.gz);
        written.push(iso);
    }
    console.log(`  ${ds}-country/*.json  (${String(data.byCountry.size).padStart(2)} files) ${kb(raw).padStart(9)} raw  ${kb(gz).padStart(8)} gz   largest ${kb(largest)}`);
    return { raw, gz, written: written.sort() };
}

function buildMetricFiles(ds, data) {
    // The data table asks for one metric across many countries, so invert the layout.
    const spans = {};
    for (const [iso, rs] of data.byCountry) {
        spans[iso] = { location: rs[0][data.idx.location], ...dateSpan(rs.map(r => r[data.idx.date].slice(0, 10))) };
    }
    /*
     * Every column gets a file, the per-country ones (tests_units,
     * hospital_beds_per_thousand and the demographics) included. They are constant per
     * country so they cost almost nothing compressed, and the data table can ask for any
     * column the old SQL could - its dropdown offers tests_units.
     */
    const columns = data.header.filter(h => h !== '_id' && h !== 'date' && h !== 'iso_code');
    let raw = 0, gz = 0, largest = 0, largestName = '';
    const written = [];
    for (const metric of columns) {
        const v = {};
        for (const [iso, rs] of data.byCountry) v[iso] = rs.map(r => num(r[data.idx[metric]]));
        const s = write(path.join(OUT, `${ds}-metric`, `${metric}.json`), { metric, countries: spans, v });
        raw += s.raw; gz += s.gz;
        written.push(metric);
        if (s.gz > largest) { largest = s.gz; largestName = metric; }
    }
    console.log(`  ${ds}-metric/*.json   (${String(columns.length).padStart(2)} files) ${kb(raw).padStart(9)} raw  ${kb(gz).padStart(8)} gz   largest ${kb(largest)} (${largestName})`);
    return { raw, gz, written: written.sort() };
}

/*
 * Parcel's dev server only serves what is in the module graph - files dropped into
 * dist are answered with index.html - so the bundle is reached through import()
 * rather than fetch(). This emits an explicit map of lazy imports, which Parcel can
 * statically analyse and split into one chunk per file, loaded on demand.
 */
function writeManifest(shape) {
    const lines = [
        '// GENERATED by scripts/build-data.js - do not edit.',
        '',
        'export const cases = {'
    ];
    for (const ds of Object.keys(shape)) {
        lines.push(`    ${ds}: () => import('./${ds}-cases.json'),`);
    }
    lines.push('};', '', 'export const country = {');
    for (const ds of Object.keys(shape)) {
        lines.push(`    ${ds}: {`);
        for (const iso of shape[ds].countries) {
            lines.push(`        ${iso}: () => import('./${ds}-country/${iso}.json'),`);
        }
        lines.push('    },');
    }
    lines.push('};', '', 'export const metric = {');
    for (const ds of Object.keys(shape)) {
        lines.push(`    ${ds}: {`);
        for (const m of shape[ds].metrics) {
            lines.push(`        ${m}: () => import('./${ds}-metric/${m}.json'),`);
        }
        lines.push('    },');
    }
    lines.push('};', '');
    const file = path.join(OUT, 'manifest.js');
    fs.writeFileSync(file, lines.join('\n') + '\n');
    const chunks = Object.keys(shape).reduce((n, ds) => n + 1 + shape[ds].countries.length + shape[ds].metrics.length, 0);
    console.log(`  manifest.js: ${chunks} lazy chunks`);
}

function main() {
    fs.rmSync(OUT, { recursive: true, force: true });
    const index = {};
    const shape = {};
    const startup = {};
    let totalGz = 0, failed = false;

    for (const ds of ['owid', 'acdc']) {
        console.log(`\n${ds}:`);
        const cases = RESOURCES.find(r => r.dataset === ds && r.kind === 'cases');
        const countries = RESOURCES.find(r => r.dataset === ds && r.kind === 'countries');
        const caseData = load(cases);
        const countryData = load(countries);
        if (!caseData || !countryData) { failed = true; continue; }

        const c = buildCases(ds, caseData);
        const perCountry = buildCountryFiles(ds, countryData);
        const perMetric = buildMetricFiles(ds, countryData);
        shape[ds] = { countries: perCountry.written, metrics: perMetric.written };
        startup[ds] = c.gz;
        totalGz += c.gz + perCountry.gz + perMetric.gz;

        const datesIn = data => {
            const all = new Set();
            for (const rs of data.byCountry.values()) for (const r of rs) all.add(r[data.idx.date].slice(0, 10));
            return [...all].sort();
        };
        const dates = datesIn(caseData);
        const countryDates = datesIn(countryData);
        index[ds] = {
            dateMin: dates[0],
            dateMax: dates[dates.length - 1],
            // The data table drives its date picker off the country table, whose span
            // can differ from the case table's.
            countryDateMin: countryDates[0],
            countryDateMax: countryDates[countryDates.length - 1],
            rows: caseData.rows,
            countries: [...caseData.byCountry.keys()].sort(),
            // what the data table can ask for, i.e. what has a metric file
            metrics: perMetric.written
        };
        console.log(`  ${caseData.rows.toLocaleString()} case rows, ${countryData.rows.toLocaleString()} country rows, ${dates[0]} -> ${dates[dates.length - 1]}`);
    }

    write(path.join(OUT, 'index.json'), index);
    if (!failed) writeManifest(shape);
    console.log(`\n${failed ? 'INCOMPLETE - some inputs were missing or malformed.' : 'Done.'}`);
    // Only one dataset is ever active in a session, so report the startup cost per dataset.
    for (const ds of Object.keys(startup)) {
        console.log(`Startup cost (${ds}): ${kb(startup[ds])} gzipped. Everything else loads on demand.`);
    }
    console.log(`Bundle total: ${kb(totalGz)} gzipped on disk.`);
    if (failed) process.exit(1);
}

main();
