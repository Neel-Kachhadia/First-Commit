import 'dotenv/config';
import { randomUUID, createHmac, createHash } from 'crypto';
import { dynamo } from './store/dynamodb.js';
import { TABLE_NAME } from './store/table.js';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const BASE_URL = 'http://localhost:4000';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret';

let passed = 0;
let failed = 0;

function pass(name: string) {
  console.log(`\x1b[32m[PASS] ${name}\x1b[0m`);
  passed++;
}

function fail(name: string, reason?: any) {
  console.log(`\x1b[31m[FAIL] ${name}\x1b[0m`);
  if (reason) console.log(`       ${reason}`);
  failed++;
}

async function postJson(path: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, text }; }
}

async function getJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, text }; }
}

async function getGrantFromDb(userId: string, grantId: string) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: `GRANT#${grantId}` },
  }));
  return result.Item;
}

function createWebhookPayload(event: string, intentId: string, orderId: string, paymentId: string, amountPaise: number) {
  return JSON.stringify({
    entity: "event",
    event: event,
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: amountPaise,
          currency: "INR",
          status: event.split('.')[1],
          notes: { intentId }
        }
      }
    }
  });
}

function signWebhook(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

async function runTests() {
  console.log('\n============================================================');
  console.log(' KAVACHPAY TEST SUITE V2 (Security & Webhooks)');
  console.log('============================================================\n');

  const userId = `u_v2test_${Date.now()}`;
  
  // --------------------------------------------------------
  // FIXTURE: Create Parent and Child
  // --------------------------------------------------------
  const pRes = await postJson('/v0/grants', {
    userId, label: 'V2 Parent', currency: 'INR', limit: 10000, window: 'WEEKLY',
    windowStart: new Date().toISOString(), hardMax: 4500, category: 'GROCERY',
    delegationEnabled: true, maxDepth: 1, maxChildren: 5
  });
  if (!pRes.data.success) {
    console.error("Parent creation failed:", pRes.data);
    process.exit(1);
  }
  const parentId = pRes.data.grant.grantId;

  const cRes = await postJson('/v0/grants', {
    userId, label: 'V2 Child', parentGrantId: parentId, currency: 'INR', limit: 8000, window: 'WEEKLY',
    windowStart: new Date().toISOString(), hardMax: 4500, category: 'GROCERY',
    delegationEnabled: false, maxDepth: 0, maxChildren: 0
  });
  if (!cRes.data.success) {
    console.error("Child creation failed:", cRes.data);
    process.exit(1);
  }
  const childId = cRes.data.grant.grantId;

  console.log(`Test Fixture Ready. Parent: ${parentId}, Child: ${childId}\n`);

  // --------------------------------------------------------
  // 17. CONCURRENT RESERVATION
  // --------------------------------------------------------
  console.log('========== 17 - CONCURRENCY ==========');
  // Child has 4500. Send two simultaneous 4500 INR requests (450000 paise).
  const cBody1 = {
    userId, grantId: childId, amount: 450000, currency: 'INR',
    merchant: { merchantId: 'm1', name: 'M1', category: 'GROCERY' },
    idempotencyKey: `conc1_${Date.now()}`
  };
  const cBody2 = { ...cBody1, idempotencyKey: `conc2_${Date.now()}` };

  const [res1, res2] = await Promise.all([
    postJson('/api/create-order', cBody1),
    postJson('/api/create-order', cBody2)
  ]);

  const succ1 = res1.data.success;
  const succ2 = res2.data.success;

  const dbChild17 = (await getGrantFromDb(userId, childId))!;
  
  if ((succ1 && !succ2) || (!succ1 && succ2)) {
    if (dbChild17.consumed === 4500) {
      pass("Concurrent reservation handled atomically (consumed = 4500)");
    } else {
      fail("Concurrency failed", `Expected consumed 4500, got ${dbChild17.consumed}`);
    }
  } else {
    fail("Concurrency failed", `Expected exactly one success. Got ${succ1} and ${succ2}`);
    if (!succ1) console.error("res1:", res1.data);
    if (!succ2) console.error("res2:", res2.data);
  }

  // --------------------------------------------------------
  // 18. PAYMENT FAILURE -> COMPENSATION
  // --------------------------------------------------------
  console.log('\n========== 18 - FAILURE COMPENSATION ==========');
  const fBody = {
    userId, grantId: childId, amount: 10000, currency: 'INR', // 100 INR
    merchant: { merchantId: 'm1', name: 'M1', category: 'GROCERY' },
    idempotencyKey: `fail_${Date.now()}`
  };
  const fRes = await postJson('/api/create-order', fBody);
  if (!fRes.data.success) {
    fail("Failed to create order for Test 18", JSON.stringify(fRes.data));
    process.exit(1);
  }
  const fIntentId = fRes.data.intentId;
  const fOrderId = fRes.data.order_id;

  const dbBeforeFail = (await getGrantFromDb(userId, childId))!;
  const cBeforeFail = dbBeforeFail.consumed;

  // Webhook for failure
  const fWebhook = createWebhookPayload('payment.failed', fIntentId, fOrderId, 'pay_fail123', 10000);
  const fSig = signWebhook(fWebhook, WEBHOOK_SECRET);
  await postJson('/v0/webhooks/razorpay', JSON.parse(fWebhook), {
    'X-Razorpay-Signature': fSig,
    'X-Razorpay-Event-Id': `evt_${randomUUID()}`
  });

  const dbAfterFail = (await getGrantFromDb(userId, childId))!;
  if (dbAfterFail.consumed === cBeforeFail - 100) {
    pass("Payment failure triggers automatic release and compensation");
  } else {
    fail("Payment failure compensation failed", `Expected ${cBeforeFail - 100}, got ${dbAfterFail.consumed}`);
  }

  // --------------------------------------------------------
  // 19. WEBHOOK SECURITY
  // --------------------------------------------------------
  console.log('\n========== 19 - WEBHOOK SECURITY ==========');
  const wBody = {
    userId, grantId: childId, amount: 10000, currency: 'INR', // 100 INR
    merchant: { merchantId: 'm1', name: 'M1', category: 'GROCERY' },
    idempotencyKey: `wh_${Date.now()}`
  };
  const wRes = await postJson('/api/create-order', wBody);
  if (!wRes.data.success) {
    fail("Failed to create order for Test 19", JSON.stringify(wRes.data));
    process.exit(1);
  }
  const wIntentId = wRes.data.intentId;
  const wOrderId = wRes.data.order_id;

  const whPayload = createWebhookPayload('payment.captured', wIntentId, wOrderId, 'pay_cap123', 10000);
  
  // A. Invalid signature
  const wResBad = await postJson('/v0/webhooks/razorpay', JSON.parse(whPayload), {
    'X-Razorpay-Signature': 'invalid_signature',
    'X-Razorpay-Event-Id': `evt_${randomUUID()}`
  });
  if (wResBad.status >= 400) pass("Invalid signature rejected (HTTP 400/500)");
  else fail("Invalid signature accepted");

  // B. Valid signature
  const validSig = signWebhook(whPayload, WEBHOOK_SECRET);
  const eventId = `evt_${randomUUID()}`;
  const wResGood = await postJson('/v0/webhooks/razorpay', JSON.parse(whPayload), {
    'X-Razorpay-Signature': validSig,
    'X-Razorpay-Event-Id': eventId
  });
  if (wResGood.status === 200) pass("Valid signature accepted (HTTP 200)");
  else fail("Valid signature rejected", wResGood.data);

  // C. Same event twice
  const wResDup = await postJson('/v0/webhooks/razorpay', JSON.parse(whPayload), {
    'X-Razorpay-Signature': validSig,
    'X-Razorpay-Event-Id': eventId
  });
  if (wResDup.status === 200 && wResDup.data?.duplicate) pass("Duplicate webhook event ignored safely");
  else fail("Duplicate webhook handled incorrectly", wResDup.data);

  // --------------------------------------------------------
  // 20. AMOUNT MISMATCH
  // --------------------------------------------------------
  console.log('\n========== 20 - AMOUNT MISMATCH ==========');
  const aBody = {
    userId, grantId: childId, amount: 10000, currency: 'INR', // 100 INR
    merchant: { merchantId: 'm1', name: 'M1', category: 'GROCERY' },
    idempotencyKey: `amt_${Date.now()}`
  };
  const aRes = await postJson('/api/create-order', aBody);
  if (!aRes.data.success) {
    fail("Failed to create order for Test 20", JSON.stringify(aRes.data));
    process.exit(1);
  }
  const aIntentId = aRes.data.intentId;
  const aOrderId = aRes.data.order_id;

  // Claiming 90 INR (9000 paise) instead of 100 INR (10000 paise)
  const aPayload = createWebhookPayload('payment.captured', aIntentId, aOrderId, 'pay_a123', 9000);
  const aSig = signWebhook(aPayload, WEBHOOK_SECRET);
  const aWhRes = await postJson('/v0/webhooks/razorpay', JSON.parse(aPayload), {
    'X-Razorpay-Signature': aSig,
    'X-Razorpay-Event-Id': `evt_${randomUUID()}`
  });

  if (aWhRes.status >= 400) pass("Webhook amount mismatch rejected");
  else fail("Webhook amount mismatch accepted!");

  // --------------------------------------------------------
  // 21. IDENTITY MISMATCH
  // --------------------------------------------------------
  console.log('\n========== 21 - IDENTITY MISMATCH ==========');
  const iPayload = createWebhookPayload('payment.captured', aIntentId, 'order_completely_wrong', 'pay_i123', 10000);
  const iSig = signWebhook(iPayload, WEBHOOK_SECRET);
  const iWhRes = await postJson('/v0/webhooks/razorpay', JSON.parse(iPayload), {
    'X-Razorpay-Signature': iSig,
    'X-Razorpay-Event-Id': `evt_${randomUUID()}`
  });

  if (iWhRes.status >= 400) pass("Webhook order_id mismatch rejected");
  else fail("Webhook order_id mismatch accepted!");

  // --------------------------------------------------------
  // 22 & 23. DECISION RECEIPT INTEGRITY & REPLAY
  // --------------------------------------------------------
  console.log('\n========== 22/23 - DECISION RECEIPT INTEGRITY ==========');
  
  // Re-fetch decisions for Intent from test #19
  const dRes = await getJson(`/v0/intents/${wIntentId}/decisions`);
  if (dRes.status !== 200) {
    fail("Failed to fetch decisions", dRes.data);
  } else {
    const decisions = dRes.data.decisions;
    if (decisions && decisions.length > 0) {
      const dec = decisions[0];
      const canonicalPayload = {
        intentId: dec.intentId,
        decisionId: dec.decisionId,
        grantId: dec.grantId,
        decision: dec.decision,
        reasonCode: dec.reasonCode,
        amount: dec.amount,
        currency: dec.currency,
        effectiveCapacity: dec.effectiveCapacity,
        reserved: dec.reserved,
        createdAt: dec.createdAt,
      };
      
      const computedHash = createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
      if (computedHash === dec.receiptHash) pass("Decision receipt hash cryptographic integrity verified");
      else {
        fail("Decision receipt hash mismatch", `Expected ${computedHash}, got ${dec.receiptHash}`);
        console.log("Canonical Payload String:", JSON.stringify(canonicalPayload));
      }

      // Replay identical intent
      const rRes = await postJson('/v0/intents', wBody);
      if (rRes.data?.replayed && rRes.data?.intent?.intentId === wIntentId) {
        pass("Decision replay returned same intent stably");
      } else {
        fail("Decision replay failed", JSON.stringify(rRes.data));
      }
    } else {
      fail("No decisions returned for intent");
    }
  }

  // --------------------------------------------------------
  // 24. SCOPE ATTACK MATRIX
  // --------------------------------------------------------
  console.log('\n========== 24 - SCOPE ATTACK MATRIX ==========');
  // 24a. Wrong category
  const badCat = await postJson('/api/create-order', {
    userId, grantId: childId, amount: 10000, currency: 'INR',
    merchant: { merchantId: 'm1', name: 'M1', category: 'ELECTRONICS' },
    idempotencyKey: `bad_cat_${Date.now()}`
  });
  if (badCat.data.error === "Payment denied by KavachPay" && JSON.stringify(badCat.data).includes("SCOPE_DENIED")) pass("Wrong category rejected (DENY)");
  else fail("Wrong category check failed", JSON.stringify(badCat.data));

  // 24b. Above HardMax
  const badHard = await postJson('/api/create-order', {
    userId, grantId: childId, amount: 500000, currency: 'INR', // 5000 > 4500
    merchant: { merchantId: 'm1', name: 'M1', category: 'GROCERY' },
    idempotencyKey: `bad_hard_${Date.now()}`
  });
  if (badHard.data.error === "Payment denied by KavachPay") pass("Amount > hardMax rejected (DENY)");
  else fail("HardMax check failed", JSON.stringify(badHard.data));

  // 24c. Above Effective Capacity
  const badCap = await postJson('/api/create-order', {
    userId, grantId: childId, amount: 900000, currency: 'INR', // 9000 > limit
    merchant: { merchantId: 'm1', name: 'M1', category: 'GROCERY' },
    idempotencyKey: `bad_cap_${Date.now()}`
  });
  if (badCap.data.error === "Payment denied by KavachPay") pass("Amount > effective capacity rejected (DENY)");
  else fail("Effective capacity check failed", JSON.stringify(badCap.data));

  // --------------------------------------------------------
  // 25. REVOCATION AFTER RESERVATION
  // --------------------------------------------------------
  console.log('\n========== 25 - REVOCATION AFTER RESERVATION ==========');
  // First, verify current consumed amount is intact
  const dbBeforeRevoke = (await getGrantFromDb(userId, childId))!;
  const consumedBefore = dbBeforeRevoke.consumed;

  // Revoke Parent
  const revRes = await postJson(`/v0/grants/${parentId}/revoke`, { userId });
  if (revRes.data.success) pass("Parent revoked successfully");
  else fail("Parent revocation failed", revRes.data);

  // Try new request on Child
  const afterRevRes = await postJson('/api/create-order', {
    userId, grantId: childId, amount: 10000, currency: 'INR',
    merchant: { merchantId: 'm1', name: 'M1', category: 'GROCERY' },
    idempotencyKey: `after_rev_${Date.now()}`
  });
  if (afterRevRes.data.error === "Payment denied by KavachPay") pass("Post-revocation request correctly denied");
  else fail("Post-revocation request accepted!", JSON.stringify(afterRevRes.data));

  // Verify historical accounting is preserved
  const dbAfterRevoke = (await getGrantFromDb(userId, childId))!;
  if (dbAfterRevoke.consumed === consumedBefore) pass("Historical consumed accounting preserved after revocation");
  else fail("Historical accounting corrupted", `Expected ${consumedBefore}, got ${dbAfterRevoke.consumed}`);

  console.log('\n========== CLEANUP ==========');
  try {
    await dynamo.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: `GRANT#${childId}` } }));
    await dynamo.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${userId}`, SK: `GRANT#${parentId}` } }));
    pass("Test fixtures cleaned up from DynamoDB (Self-cleaning)");
  } catch (e: any) {
    fail("Cleanup failed", e.message);
  }

  console.log('\n============================================================');
  console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
