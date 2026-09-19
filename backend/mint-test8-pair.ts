import { randomUUID } from 'crypto';
import { grantRepository } from './src/store/grant-repository.ts';
import type { Grant } from './src/store/grant-repository.ts';

(async () => {
  const userId = 'u_revocation_test_' + Date.now();
  const now = new Date().toISOString();

  const parentGrantId = 'g_' + randomUUID();
  const childGrantId = 'g_' + randomUUID();

  console.log('');
  console.log('============================================================');
  console.log(' MINTING FRESH REVOCATION TEST PAIR');
  console.log('============================================================');
  console.log('User:', userId);
  console.log('');

  // 1. Create Parent
  const parentGrant: Grant = {
    grantId: parentGrantId,
    userId,
    label: 'Revocation Test Parent',
    currency: 'INR',
    limit: 5000,
    consumed: 0,
    window: 'WEEKLY',
    windowStart: now,
    hardMax: 2000,
    category: 'GROCERY',
    merchantAllow: [],
    merchantDeny: [],
    delegationEnabled: true,
    maxDepth: 3,
    maxChildren: 10,
    status: 'ACTIVE',
    evidence: {
      sourceProtocol: 'TEST',
      mandateRef: 'revocation_test_' + Date.now(),
      signedBy: 'test-harness',
    },
    createdAt: now,
    updatedAt: now,
  };

  await grantRepository.createGrant(parentGrant);
  console.log('PARENT CREATED');
  console.log('Parent ID:', parentGrantId);
  console.log('');

  // 2. Create Child
  const childGrant: Grant = {
    grantId: childGrantId,
    userId,
    label: 'Revocation Test Child',
    parentGrantId: parentGrantId,
    currency: 'INR',
    limit: 2000,
    consumed: 0,
    window: 'WEEKLY',
    windowStart: now,
    hardMax: 1000,
    category: 'GROCERY',
    merchantAllow: [],
    merchantDeny: [],
    delegationEnabled: false,
    maxDepth: 0,
    maxChildren: 0,
    status: 'ACTIVE',
    evidence: {
      sourceProtocol: 'TEST',
      mandateRef: 'revocation_test_child_' + Date.now(),
      signedBy: 'test-harness',
    },
    createdAt: now,
    updatedAt: now,
  };

  await grantRepository.createGrant(childGrant);
  console.log('CHILD CREATED');
  console.log('Child ID :', childGrantId);
  console.log('');

  // 3. Print values for test8.ps1
  console.log('============================================================');
  console.log(' COPY THESE VALUES INTO test8.ps1');
  console.log('============================================================');
  console.log('');
  console.log(`$parentId = "${parentGrantId}"`);
  console.log(`$childId  = "${childGrantId}"`);
  console.log(`$userId   = "${userId}"`);
  console.log('');
  console.log('============================================================');
  console.log(' PARENT -> CHILD PAIR READY');
  console.log('============================================================');
})().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
