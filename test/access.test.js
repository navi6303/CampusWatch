import test from 'node:test';
import assert from 'node:assert/strict';
import {pageAt, permitted, validSession, paths} from '../src/access.js';

test('campus map opens directly and all remaining navigation paths resolve', () => {
  assert.equal(pageAt('/'), 'Map');
  for (const [name, path] of Object.entries(paths)) assert.equal(pageAt(path + '/'), name);
  for (const retired of ['/student/login','/admin/login']) assert.equal(pageAt(retired), 'Missing');
  for (const name of ['Admin','Report','Mine']) assert(permitted(name, 'local'));
});

test('connected administrative and student views retain account requirements', () => {
  for (const role of ['guest','student']) assert(!permitted('Admin', role));
  assert(permitted('Admin','admin'));
  assert(permitted('Mine','student'));
  assert(!permitted('Report','guest'));
  assert(permitted('Map','guest'));
  const session = {user:{id:'test'}, expires_at:10};
  assert(validSession(session,9999));
  assert(!validSession(session,10000));
  assert(!validSession(null));
});
