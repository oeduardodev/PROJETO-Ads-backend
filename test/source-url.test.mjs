import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeAuthorizedHost,
  normalizeSourceUrl,
} from '../apps/api/dist/modules/sources/source-url.js';

test('source URL keeps an official HTTPS host and removes fragments', () => {
  assert.equal(normalizeAuthorizedHost('  WWW.PRG.UFPB.BR '), 'www.prg.ufpb.br');
  assert.deepEqual(normalizeSourceUrl('https://www.prg.ufpb.br/editais/ingressantes/#top'), {
    url: 'https://www.prg.ufpb.br/editais/ingressantes/',
    host: 'www.prg.ufpb.br',
  });
});

test('private, malformed and credentialed URLs are rejected', () => {
  for (const url of [
    'http://www.prg.ufpb.br/editais/',
    'https://127.0.0.1/editais/',
    'https://localhost/editais/',
    'https://intranet.local/editais/',
    'https://user:secret@www.prg.ufpb.br/editais/',
    'https://www.prg.ufpb.br:8443/editais/',
    'https://www.prg.ufpb.br/\neditais/',
  ]) {
    assert.throws(() => normalizeSourceUrl(url), Error, url);
  }
});
