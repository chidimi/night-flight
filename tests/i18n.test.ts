import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseLocale } from '../src/i18n.ts';

await test('saved language overrides browser preferences', () => {
  assert.equal(chooseLocale('ja', ['en-US']), 'ja');
  assert.equal(chooseLocale('en', ['ja-JP']), 'en');
});

await test('language selection handles regional tags, invalid storage and unsupported languages', () => {
  assert.equal(chooseLocale(null, ['ja-JP']), 'ja');
  assert.equal(chooseLocale('invalid', ['fr-FR', 'en-GB', 'ja']), 'en');
  assert.equal(chooseLocale(null, ['fr', 'JA-jp']), 'ja');
  assert.equal(chooseLocale(null, ['fr']), 'en');
  assert.equal(chooseLocale(null, []), 'en');
});
