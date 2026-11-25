import assert from 'node:assert/strict';
import {
  isTableSeparator,
  parseTableAlignments,
  parseTableRowCells,
  parseMarkdownBlocks,
  tokenizeInlineMarkdown,
  sanitizeLinkUrl,
  stripThinkTags,
} from '../src/lib/markdown.ts';

console.log('--- 🧪 STARTING REAL MARKDOWN PARSER UNIT TESTS ---');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test('isTableSeparator rejects plain horizontal rules (---, -----------------)', () => {
  assert.equal(isTableSeparator('---'), false);
  assert.equal(isTableSeparator('-----------------'), false);
  assert.equal(isTableSeparator('***'), false);
  assert.equal(isTableSeparator('___'), false);
  assert.equal(isTableSeparator('   -----------------   '), false);
  assert.equal(isTableSeparator('| a | b |'), false);
  assert.equal(isTableSeparator('|||'), false);
});

test('isTableSeparator accepts valid pipe separators and alignments', () => {
  assert.equal(isTableSeparator('| :--- | :---: | ---: |'), true);
  assert.equal(isTableSeparator('---|---|---'), true);
  assert.equal(isTableSeparator('| --- |'), true);
  assert.deepEqual(parseTableAlignments('| :--- | :---: | ---: | --- |'), [
    'left',
    'center',
    'right',
    'left',
  ]);
});

test('parseTableRowCells handles escaped pipes (\\|)', () => {
  const cells = parseTableRowCells('| Kolom \\| Satu | Kolom Dua | Akhir \\| |');
  assert.deepEqual(cells, ['Kolom | Satu', 'Kolom Dua', 'Akhir |']);
});

test('parseMarkdownBlocks parses standard GFM table + alignments + headings + lists', () => {
  const md = `
Berikut adalah daftar anggota tim Productivier:

| ID | Nama | Username | Divisi | Role |
| :--- | :---: | :--- | :--- | ---: |
| 1 | Fifa | fifa | Operasional & Konten | admin |
| 2 | Anggota Tim 1 | tim1 | Operasional | karyawan |
| 4 | Anggota Tim 2 | tim2 | Technology | Lead Developer |

-----------------

### Catatan Tambahan
- [x] **Status Integrasi**: Selesai 100%
- [ ] Review final oleh QA
`;
  const blocks = parseMarkdownBlocks(md);
  const table = blocks.find((b) => b.type === 'table');
  assert.ok(table, 'Table block should exist');
  assert.equal(table.headers.length, 5);
  assert.equal(table.rows.length, 3);
  assert.deepEqual(table.alignments, ['left', 'center', 'left', 'left', 'right']);
  assert.deepEqual(table.rows[0], ['1', 'Fifa', 'fifa', 'Operasional & Konten', 'admin']);

  const hr = blocks.find((b) => b.type === 'hr');
  assert.ok(hr, 'Plain ----------------- should parse as hr, not table');

  const ul = blocks.find((b) => b.type === 'ul');
  assert.ok(ul, 'Bullet list should exist');
  assert.equal(ul.items[0].checked, true);
  assert.equal(ul.items[1].checked, false);
});

test('parseMarkdownBlocks recovers wrapped table rows with dangling trailing pipe', () => {
  const wrappedMd = `
| ID | Nama | Divisi | Role
|
| :--- | :--- | :--- | :--- |
| 1 | Fifa | Management |
admin |
| 2 | Tim 1 | Operasional
& Konten | karyawan |
| 3 | Tim 2 | Kreatif | staff
|
`;
  const blocks = parseMarkdownBlocks(wrappedMd);
  const table = blocks.find((b) => b.type === 'table');
  assert.ok(table, 'Wrapped table should still parse as table');
  assert.deepEqual(table.headers, ['ID', 'Nama', 'Divisi', 'Role']);
  assert.equal(table.rows.length, 3);
  assert.deepEqual(table.rows[0], ['1', 'Fifa', 'Management', 'admin']);
  assert.deepEqual(table.rows[1], ['2', 'Tim 1', 'Operasional & Konten', 'karyawan']);
  assert.deepEqual(table.rows[2], ['3', 'Tim 2', 'Kreatif', 'staff']);
});

test('parseMarkdownBlocks parses table when separator row is omitted by AI', () => {
  const noSepMd = `
| ID | Nama | Role |
| 1 | Fifa | admin |
| 2 | Tim 1 | karyawan |
`;
  const blocks = parseMarkdownBlocks(noSepMd);
  const table = blocks.find((b) => b.type === 'table');
  assert.ok(table, 'Table without separator row should still parse');
  assert.deepEqual(table.headers, ['ID', 'Nama', 'Role']);
  assert.equal(table.rows.length, 2);
  assert.deepEqual(table.rows[0], ['1', 'Fifa', 'admin']);
  assert.deepEqual(table.rows[1], ['2', 'Tim 1', 'karyawan']);
});

test('tokenizeInlineMarkdown supports __bold__, _italic_, ~~strike~~, `code`, [link], and preserves snake_case', () => {
  const tokens = tokenizeInlineMarkdown(
    'Cek __penting__, _catatan_ untuk `assigned_to_user_id`, snake_case_field, ~~batal~~, dan [Docs](https://example.com/a_b)'
  );
  assert.ok(tokens.some((t) => t.type === 'bold' && t.text === 'penting'));
  assert.ok(tokens.some((t) => t.type === 'italic' && t.text === 'catatan'));
  assert.ok(tokens.some((t) => t.type === 'code' && t.text === 'assigned_to_user_id'));
  assert.ok(tokens.some((t) => t.type === 'text' && t.text.includes('snake_case_field')));
  assert.ok(tokens.some((t) => t.type === 'strike' && t.text === 'batal'));
  assert.ok(tokens.some((t) => t.type === 'link' && t.text === 'Docs' && t.url === 'https://example.com/a_b'));
});

test('stripThinkTags removes closed and unclosed <think> blocks', () => {
  assert.equal(stripThinkTags('<think>internal thought</think>\n\nHasil akhir rapi.'), 'Hasil akhir rapi.');
  assert.equal(stripThinkTags('Jawaban awal.\n<think>unclosed reasoning leaked'), 'Jawaban awal.');
  assert.equal(stripThinkTags('<think>only unclosed thought'), '');
});

test('sanitizeLinkUrl blocks javascript/data/vbscript/protocol-relative XSS URIs', () => {
  assert.equal(sanitizeLinkUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeLinkUrl('JAVASCRIPT:alert(document.cookie)'), null);
  assert.equal(sanitizeLinkUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeLinkUrl('vbscript:msgbox(1)'), null);
  assert.equal(sanitizeLinkUrl('//evil.com/phish'), null);
  assert.equal(sanitizeLinkUrl('https://productivier.id/docs'), 'https://productivier.id/docs');
  assert.equal(sanitizeLinkUrl('/?tab=projects&project_id=1'), '/?tab=projects&project_id=1');
  assert.equal(sanitizeLinkUrl('mailto:team@productivier.id'), 'mailto:team@productivier.id');
});

console.log(`\n========================================`);
console.log(`MARKDOWN TEST SUMMARY: ${passed} PASSED`);
console.log(`========================================`);
