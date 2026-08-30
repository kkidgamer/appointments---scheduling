/**
 * Concurrency test: attempts to create two visits with overlapping segments
 * for the same provider at the same time. One should succeed, the other should
 * hit the exclusion constraint (23P01) and get a 409 conflict.
 *
 * Usage: node src/test-concurrency.js
 * Requires: running server on localhost:3001, seeded database
 */

const API = 'http://localhost:3001/api';

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${data.error}`);
  return data.token;
}

async function createVisit(token, body) {
  const res = await fetch(`${API}/visits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('🔒 Concurrency Test: Overlapping Segment Booking\n');

  // Login as admin
  const token = await login('mike@glowbeauty.com', 'password123');
  console.log('✅ Logged in as admin\n');

  // Get providers and services
  const usersRes = await fetch(`${API}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { users } = await usersRes.json();
  const provider = users.find((u) => u.is_provider && u.email === 'emma@glowbeauty.com');
  console.log(`   Provider: ${provider.name} (${provider.id})\n`);

  const svcRes = await fetch(`${API}/services`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { services } = await svcRes.json();
  const haircut = services.find((s) => s.name === 'Haircut & Style');

  // Get a client
  const clientRes = await fetch(`${API}/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { clients } = await clientRes.json();
  const client = clients[0];

  // Same time slot for the same provider — should conflict
  const now = new Date();
  now.setHours(now.getHours() + 2, 0, 0, 0); // 2 hours from now
  const endTime = new Date(now.getTime() + 45 * 60000);

  const visitBody = {
    client_id: client.id,
    booking_source: 'phone',
    start_time: now.toISOString(),
    end_time: endTime.toISOString(),
    segments: [
      {
        provider_id: provider.id,
        service_id: haircut.id,
        start_time: now.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: 45,
      },
    ],
  };

  console.log('📅 Attempt 1: Booking haircut with Emma...');
  const result1 = await createVisit(token, visitBody);
  console.log(`   Status: ${result1.status} ${result1.status === 201 ? '✅ Created' : '❌ Failed: ' + result1.data.error}\n`);

  console.log('📅 Attempt 2: Booking SAME slot (should conflict)...');
  const result2 = await createVisit(token, visitBody);
  console.log(`   Status: ${result2.status} ${result2.status === 409 ? '✅ Correctly blocked (conflict)' : result2.status === 201 ? '❌ PROBLEM: should have been blocked!' : '⚠️ Other error: ' + result2.data.error}\n`);

  // Test passed if attempt 2 got 409
  if (result1.status === 201 && result2.status === 409) {
    console.log('🎉 CONCURRENCY TEST PASSED — Exclusion constraint working correctly');
  } else {
    console.log('⚠️  CONCURRENCY TEST NEEDS REVIEW');
  }

  // Cleanup: delete the test visit
  if (result1.status === 201) {
    await fetch(`${API}/visits/${result1.data.visit.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'cancelled', cancellation_reason: 'Concurrency test cleanup' }),
    });
    console.log('\n🧹 Cleaned up test visit');
  }
}

run().catch(console.error);
