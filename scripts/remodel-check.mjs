#!/usr/bin/env node
/**
 * remodel-check — deterministic invariant gate for remodel-mode output.
 *
 * Usage: node scripts/remodel-check.mjs <before.html> <after.html> [--json]
 *
 * Asserts that every integration hook present in the source document survives
 * in the remodeled document, and reports DOM churn. Exit 1 on any immutable
 * violation. Hook identity is matched as multisets (reordering-safe):
 *
 *   - element ids                (tag, id)
 *   - hook attributes: data-, aria-, role, name, for   (attrName, attrValue)
 *   - event-handler attributes   (attrName, attrValue)  e.g. onclick, x-on:
 *   - forms                      (action, method) and field names
 *   - scripts                    src values + inline content hashes
 *   - template markers           occurrence counts of {{, {%, <?php, <%=
 *
 * Churn = symmetric difference of element signature multisets
 * (tag + sorted classes + id), reported as added/removed/changed %.
 *
 * Uses htmlparser2 + domutils (repo dependencies); no new packages.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseDocument } from 'htmlparser2';
import { findAll, textContent } from 'domutils';

const [beforePath, afterPath, ...rest] = process.argv.slice(2);
const asJson = rest.includes('--json');

if (!beforePath || !afterPath) {
  console.error('usage: node scripts/remodel-check.mjs <before.html> <after.html> [--json]');
  process.exit(2);
}

const beforeHtml = readFileSync(beforePath, 'utf8');
const afterHtml = readFileSync(afterPath, 'utf8');

function bump(map, key, n = 1) {
  map.set(key, (map.get(key) || 0) + n);
}

/** Multiset subtraction: entries of a not covered by b. */
function deficit(a, b) {
  const out = [];
  const pool = new Map(b);
  for (const [key, count] of a) {
    const have = pool.get(key) || 0;
    const missing = count - Math.min(have, count);
    if (missing > 0) out.push([key, missing]);
    pool.set(key, have - Math.min(have, count));
  }
  return out;
}

const HOOK_ATTR = /^(data-|aria-|on|@|x-on:|hx-|ng-|v-on:)/;
const NAMED_ATTRS = ['role', 'name', 'for'];

function collect(html) {
  const doc = parseDocument(html);
  const elements = findAll(() => true, doc.children);

  const ids = new Map();       // "tag#id"
  const attrs = new Map();     // "name=value"
  const forms = new Map();     // "action|method"
  const scripts = new Map();   // src or "inline:<hash>"
  const sigs = new Map();      // element signature multiset (tag + id + classes)
  const struts = new Map();    // structural signature multiset (tag + id only)

  for (const el of elements) {
    const tag = el.name;
    const at = el.attribs || {};
    if (at.id) bump(ids, `${tag}#${at.id}`);
    for (const [name, value] of Object.entries(at)) {
      if (HOOK_ATTR.test(name) || NAMED_ATTRS.includes(name)) bump(attrs, `${name}=${value}`);
    }
    const classes = (at.class || '').split(/\s+/).filter(Boolean).sort().join('.');
    bump(sigs, `${tag}${at.id ? '#' + at.id : ''}${classes ? '.' + classes : ''}`);
    bump(struts, `${tag}${at.id ? '#' + at.id : ''}`);
  }
  for (const form of findAll((el) => el.name === 'form', doc.children)) {
    const at = form.attribs || {};
    bump(forms, `${at.action || ''}|${(at.method || 'get').toLowerCase()}`);
  }
  for (const s of findAll((el) => el.name === 'script', doc.children)) {
    const src = s.attribs?.src;
    bump(scripts, src || `inline:${createHash('sha1').update(textContent(s)).digest('hex').slice(0, 12)}`);
  }

  const markers = new Map();
  for (const marker of ['{{', '{%', '<?php', '<%=']) {
    const count = html.split(marker).length - 1;
    if (count > 0) bump(markers, marker, count);
  }
  return { ids, attrs, forms, scripts, sigs, struts, markers };
}

const before = collect(beforeHtml);
const after = collect(afterHtml);

const violations = [];
for (const [label, missing] of [
  ['id', deficit(before.ids, after.ids)],
  ['attribute', deficit(before.attrs, after.attrs)],
  ['form', deficit(before.forms, after.forms)],
  ['script', deficit(before.scripts, after.scripts)],
  ['template-marker', deficit(before.markers, after.markers)],
]) {
  for (const [key, count] of missing) violations.push({ type: label, key, count });
}

const removedEls = deficit(before.sigs, after.sigs).reduce((n, [, c]) => n + c, 0);
const addedEls = deficit(after.sigs, before.sigs).reduce((n, [, c]) => n + c, 0);
const removedStruct = deficit(before.struts, after.struts).reduce((n, [, c]) => n + c, 0);
const addedStruct = deficit(after.struts, before.struts).reduce((n, [, c]) => n + c, 0);
const totalBefore = [...before.sigs.values()].reduce((n, c) => n + c, 0);
const churnPct = totalBefore ? (((removedEls + addedEls) / (2 * totalBefore)) * 100).toFixed(1) : '0.0';
const structPct = totalBefore ? (((removedStruct + addedStruct) / (2 * totalBefore)) * 100).toFixed(1) : '0.0';

const report = {
  ok: violations.length === 0,
  violations,
  churn: {
    // tag+id signature churn: elements actually added or removed
    structuralPct: Number(structPct), removedElements: removedStruct, addedElements: addedStruct,
    // tag+id+classes signature churn: includes class-only edits (remodel's main edit surface)
    signaturePct: Number(churnPct),
    sourceElements: totalBefore,
  },
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const summary = `structural churn ${structPct}% (+${addedStruct}/-${removedStruct}), signature churn ${churnPct}%, ${totalBefore} source elements`;
  if (report.ok) {
    console.log(`remodel-check OK: 0 immutable violations. ${summary}`);
  } else {
    console.error(`remodel-check FAILED: ${violations.length} immutable violation(s)`);
    for (const v of violations) console.error(`  ${v.type}: ${v.key} (missing x${v.count})`);
    console.error(summary);
  }
}
process.exit(report.ok ? 0 : 1);
