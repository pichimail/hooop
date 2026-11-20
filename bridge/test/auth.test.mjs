import test from 'node:test';import assert from 'node:assert/strict';import {createAuth} from '../auth.mjs';
test('Pairing requires correct PIN, expiring bearer tokens and supports revocation',()=>{
 let time=0;const auth=createAuth({pin:'654321',now:()=>time});assert.throws(()=>auth.issue('1.2.3.4','111111'),/Invalid/);
 const {token}=auth.issue('1.2.3.4','654321');assert.equal(auth.verify(token),true);assert.equal(auth.verify('not-a-valid-token'),false);
 time=8*60*60_000+100;assert.equal(auth.verify(token),false);
 const t=auth.issue('1.2.3.4','654321').token;auth.revoke(t);assert.equal(auth.verify(t),false);
});
test('Pairing rate limits repeated bad attempts',()=>{
 const auth=createAuth({pin:'654321'});for(let i=0;i<5;i++)assert.throws(()=>auth.issue('x','111111'),/Invalid/);
 assert.throws(()=>auth.issue('x','654321'),e=>e.status===429);
});
