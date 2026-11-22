import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveReasons,nextVisibilityChange,validAgeDays} from '../src/visibility.js';
const now=Date.parse('2026-11-21T12:00:00Z');
const report=(age,status='Submitted')=>({created_at:new Date(now-age*86400000).toISOString(),occurred_at:'2020-01-01',status,verification:'Reported'});
test('active window uses creation time and includes its exact boundary',()=>{
  assert.deepEqual(archiveReasons(report(30),30,now),[]);
  assert.deepEqual(archiveReasons(report(30.0001),30,now),['Older than 30 days']);
  assert.deepEqual(archiveReasons(report(31),90,now),[]);
  assert.deepEqual(archiveReasons(report(0,'Resolved'),30,now),['Resolved']);
  assert.deepEqual(archiveReasons(report(32,'Resolved'),30,now),['Resolved','Older than 30 days']);
});
test('unknown dates, future submissions and rejected reports retain explicit history reasons',()=>{
  assert.deepEqual(archiveReasons({occurred_at:new Date(now).toISOString()},30,now),['Creation time unknown']);
  assert.deepEqual(archiveReasons(report(-1),30,now),['Future creation time']);
  assert.deepEqual(archiveReasons({...report(0),verification:'Rejected'},30,now),['Rejected']);
  assert(validAgeDays(1)&&validAgeDays(365)&&!validAgeDays(0)&&!validAgeDays(1.5));
});

test('background map updates occur when a record approaches or expires at the creation-time boundary',()=>{
  assert.equal(nextVisibilityChange([report(30),report(4)],30,now),now+1);
  assert.equal(nextVisibilityChange([report(-1),report(4)],30,now),now+86400000);
  assert.equal(nextVisibilityChange([{},report(31)],30,now),Infinity);
});
