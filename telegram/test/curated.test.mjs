import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curatedTests,seedCurated } from '../curated.mjs';
import { openStore,createDuel,duelView } from '../store.mjs';
import { categoryIds } from '../categories.mjs';
test('starter library covers all categories and can be seeded repeatedly without duplicate tests or lost user content',()=>{
  const db=openStore(':memory:');
  try {
    assert.equal(seedCurated(db),8); assert.equal(seedCurated(db),0);
    assert.deepEqual(curatedTests.map(t=>t.category).sort(),[...categoryIds].sort());
    assert.equal(curatedTests.reduce((n,t)=>n+t.questions.length,0),80);
    for (const row of db.prepare('SELECT * FROM tests').all()) {
      const questions=JSON.parse(row.questions);
      assert.equal(questions.length,10);
      assert.equal(new Set(questions.map(q=>q.question)).size,10);
      const id=createDuel(db,row.id,'1',Date.now());
      assert.equal(duelView(db,id,'1',Date.now()).total,10);
    }
  } finally {db.close();}
});
