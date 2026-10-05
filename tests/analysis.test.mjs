// Runs the pure analysis code on example data. Usage: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { shared } from './shared.mjs';

const src = shared('format', 'browser', 'net', 'octopus', 'analysis');
const ctx = vm.createContext({ console, btoa, fetch: () => Promise.reject(new Error('offline')), location: { protocol: 'file:' } });
vm.runInContext(src + '\n;globalThis.__api = { makeDemo, buildModel, gasRegression, annualGas, compareTariffs, simulateBattery, simulateSolar, solarShape, cheapestWindow, lookup, unitPriceAt, nextCapChange, weekLog, toCSV, SOLAR_SOUTH, sum };', ctx);
const A = ctx.__api;
const raw = A.makeDemo();

test('roll-up covers the requested days and prices every reading', () => {
  for (const d of [7, 30, 90]) {
    const m = A.buildModel(raw, d);
    assert.equal(m.days.length, d);
    assert.equal(m.tot.nE, d);
    assert.ok(m.tot.ec > 0 && m.tot.gc > 0);
  }
});

test('lookup finds the rate covering a time', () => {
  const list = [{ from: 0, to: 100, p: 1 }, { from: 100, to: 200, p: 2 }, { from: 200, to: Infinity, p: 3 }];
  assert.equal(A.lookup(list, 50), 1);
  assert.equal(A.lookup(list, 100), 2);
  assert.equal(A.lookup(list, 1e12), 3);
  assert.equal(A.lookup(list, -1), null);
});

test('gas regression recovers a positive heating slope', () => {
  const r = A.gasRegression(raw);
  assert.ok(r.b > 0 && r.a >= 0 && r.r2 > 0.5);
  assert.ok(A.annualGas(r).total > 1000);
});

test('battery saves nothing on a flat tariff and something on Agile', () => {
  assert.equal(A.simulateBattery(raw, t => A.unitPriceAt(raw.eSets, t), 5, 3, 0.9).saved, 0);
  assert.ok(A.simulateBattery(raw, t => A.lookup(raw.agileHist.unit, t), 5, 3, 0.9).saved > 0);
});

test('solar shape sums to one and a battery raises self-use', () => {
  for (let m = 0; m < 12; m++) assert.ok(Math.abs(A.sum(A.solarShape(m)) - 1) < 1e-9);
  const m = A.buildModel(raw, 30), monthly = A.SOLAR_SOUTH.map(v => v * 1.72);
  const a = A.simulateSolar({ profile: m.profile, monthlyKwh: monthly, importP: 25, exportP: 15 });
  const b = A.simulateSolar({ profile: m.profile, monthlyKwh: monthly, importP: 25, exportP: 15, batteryKwh: 5 });
  assert.ok(b.useShare > a.useShare);
});

test('tariff comparison ranks options over common days', () => {
  const c = A.compareTariffs(raw, [{ id: 'agile', label: 'Agile', unit: raw.agileHist.unit, sc: raw.agileHist.sc }]);
  assert.equal(c.rows.length, 2);
  assert.ok(c.rows[0].total <= c.rows[1].total);
});

test('cheapest window is contiguous and in the future', () => {
  const now = raw.agileHist.unit.at(-48).from;
  const w = A.cheapestWindow(raw.agileHist.unit, 4, now);
  assert.equal(w.to - w.from, 4 * 1800e3);
  assert.ok(w.to > now);
});

test('price cap countdown lands on a quarter day', () => {
  const c = A.nextCapChange(new Date('2026-10-05T12:00:00'));
  assert.equal(c.next.getMonth(), 0);
  assert.equal(c.next.getDate(), 1);
});

test('CSV has a header and a row per half hour', () => {
  const lines = A.toCSV(raw).split('\n');
  assert.match(lines[0], /^interval_start,/);
  assert.equal(lines.length - 1, raw.elec.length);
});
