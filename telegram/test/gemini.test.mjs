import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../store.mjs';
import { createGenerator, GEMINI_MODEL } from '../gemini.mjs';

const env = { GEMINI_API_KEY: 'fake-key-for-tests', GEMINI_FREE_TIER_CONFIRMED: 'true' };
const q = { question: 'Два плюс два?', options: ['4','5','6','7'], correct: 0, explanation: '2 + 2 = 4' };
const response = () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ questions: [q] }) }] } }] });

test('Gemini uses the pinned model, sends the secret only in a server header and caches identical requests', async () => {
  const db = openStore(':memory:');
  let calls = 0;
  try {
    const generate = createGenerator(db, env, async (url, options) => {
      calls++; assert.ok(url.includes(GEMINI_MODEL)); assert.ok(!url.includes(env.GEMINI_API_KEY));
      assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
      assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, 'application/json');
      return response();
    });
    assert.equal((await generate('1', { topic: 'Арифметика', count: 1 })).cached, false);
    assert.equal((await generate('1', { topic: 'Арифметика', count: 1 })).cached, true);
    assert.equal(calls, 1);
    await generate('2', { topic: 'Арифметика', count: 1 });
    assert.equal(calls, 2);
  } finally { db.close(); }
});

test('Gemini fails closed without a key or Free tier confirmation', async () => {
  const db = openStore(':memory:');
  try {
    const neverFetch = () => { throw new Error('must not call provider'); };
    await assert.rejects(createGenerator(db, {}, neverFetch)('1', { topic: 'Тема' }), /не подключена/);
    await assert.rejects(createGenerator(db, { GEMINI_API_KEY: 'fake' }, neverFetch)('1', { topic: 'Тема' }), /Free tier/);
  } finally { db.close(); }
});

test('Gemini stops on quota errors and never retries or switches provider', async () => {
  const db = openStore(':memory:');
  let calls = 0;
  try {
    const generate = createGenerator(db, env, async () => { calls++; return new Response('', { status: 429 }); });
    await assert.rejects(generate('1', { topic: 'История', count: 1 }), /квота/);
    await assert.rejects(generate('2', { topic: 'География', count: 1 }), /занят/);
    assert.equal(calls, 1);
  } finally { db.close(); }
});

test('Gemini caps daily per-user quota before requesting and rejects invalid generated questions', async () => {
  const db = openStore(':memory:');
  let calls = 0;
  try {
    const generate = createGenerator(db, env, async () => { calls++; return response(); });
    for (let i = 0; i < 5; i++) await generate('1', { topic: `Тема ${i}`, count: 1 });
    await assert.rejects(generate('1', { topic: 'Шестая тема', count: 1 }), /лимит/);
    assert.equal(calls, 5);
    const invalid = createGenerator(db, env, async () => Response.json({ candidates: [{ content: { parts: [{ text: '{"questions":[{}]}' }] } }] }));
    await assert.rejects(invalid('2', { topic: 'Новая тема', count: 1 }), /некорректные/);
  } finally { db.close(); }
});
