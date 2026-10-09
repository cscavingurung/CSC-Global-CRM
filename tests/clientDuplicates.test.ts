import { test, eq } from './harness';
import { findBranchDuplicate } from '/src/clientDuplicates';
import type { IntakeStudent } from '/src/types';

const s = (p: Partial<IntakeStudent>) => ({ id: 's1', name: 'Ram', phone: '+977 9812345678', email: 'ram@x.com', branch: 'Kathmandu', ...p }) as IntakeStudent;

test('same phone in the same branch matches, regardless of country code or spacing', () => {
  eq(findBranchDuplicate([s({})], 'Kathmandu', '9812345678', '')?.id, 's1');
  eq(findBranchDuplicate([s({})], 'Kathmandu', '+977 98123 45678', 'other@x.com')?.id, 's1');
});

test('same email in the same branch matches, case-insensitively', () => {
  eq(findBranchDuplicate([s({})], 'Kathmandu', '+977 9800000000', ' RAM@X.com ')?.id, 's1');
});

test('another branch, or no matching phone/email, is not a duplicate', () => {
  eq(findBranchDuplicate([s({})], 'Pokhara', '9812345678', 'ram@x.com'), null);
  eq(findBranchDuplicate([s({})], 'Kathmandu', '9800000000', 'sita@x.com'), null);
});

test('blank email never matches a blank email', () => {
  eq(findBranchDuplicate([s({ email: '' })], 'Kathmandu', '9800000000', ''), null);
});
