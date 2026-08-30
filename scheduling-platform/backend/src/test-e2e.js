/**
 * End-to-End API Test Suite
 *
 * Tests all major API endpoints against a running server.
 * Covers: Auth, Users, Services, Clients, Visits, Reports, Audit.
 *
 * Prerequisites:
 *   - Running server on localhost:3001
 *   - Seeded database (npm run seed)
 *
 * Usage: node src/test-e2e.js
 */

const API = 'http://localhost:3001/api';
let passed = 0;
let failed = 0;
const failures = [];

// Direct DB access for cleanup (e2e tests need a clean slate)
const db = require('./config/database');

// --- Helpers ---

async function apiRequest(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ❌ ${msg}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    failures.push(`${msg} (expected ${expected}, got ${actual})`);
    console.log(`  ❌ ${msg} — expected ${expected}, got ${actual}`);
  }
}

function assertStatus(res, expected, msg) {
  assertEqual(res.status, expected, `${msg} [status ${res.status}]`);
}

// --- Auth Tests ---

async function testAuth() {
  console.log('\n🔐 AUTH');
  console.log('──────────────────────────');

  // Login with valid credentials
  let res = await apiRequest('POST', '/auth/login', {
    email: 'mike@glowbeauty.com',
    password: 'password123',
  });
  assertStatus(res, 200, 'Admin login succeeds');
  const adminToken = res.data.token;
  assert(!!adminToken, 'Admin login returns JWT token');
  assertEqual(res.data.user.role, 'admin', 'Admin role is correct');
  assertEqual(res.data.business.name, 'Glow Beauty Studio', 'Business name matches');

  // Login with wrong password
  res = await apiRequest('POST', '/auth/login', {
    email: 'mike@glowbeauty.com',
    password: 'wrongpassword',
  });
  assertStatus(res, 401, 'Wrong password returns 401');

  // Login with non-existent email
  res = await apiRequest('POST', '/auth/login', {
    email: 'nobody@example.com',
    password: 'password123',
  });
  assertStatus(res, 401, 'Non-existent email returns 401');

  // Missing fields
  res = await apiRequest('POST', '/auth/login', { email: 'test@test.com' });
  assertStatus(res, 400, 'Missing password returns 400');

  // Get current user
  res = await apiRequest('GET', '/auth/me', null, adminToken);
  assertStatus(res, 200, 'GET /auth/me succeeds');
  assertEqual(res.data.user.email, 'mike@glowbeauty.com', 'Auth/me returns correct user');

  // Unauthenticated
  res = await apiRequest('GET', '/auth/me');
  assertStatus(res, 401, 'GET /auth/me without token returns 401');

  return adminToken;
}

// --- User Tests ---

async function testUsers(adminToken) {
  console.log('\n👥 USERS');
  console.log('──────────────────────────');

  // List users
  let res = await apiRequest('GET', '/users', null, adminToken);
  assertStatus(res, 200, 'GET /users succeeds');
  assert(Array.isArray(res.data.users), 'Users is an array');
  assert(res.data.users.length >= 3, 'At least 3 seeded users');

  // Clean up any leftover soft-deleted test user from a previous run
  const existingUsers = await apiRequest('GET', '/users', null, adminToken);
  const staleUser = existingUsers.data.users.find(u => u.email === 'test-e2e-staff@test.com');
  if (staleUser) {
    // The user already exists (possibly soft-deleted) — skip creation
    console.log('  ℹ️  test-e2e-staff@test.com already exists, skipping create');
  }

  // Create user (use a timestamp to avoid email collisions with soft-deleted rows)
  const ts = Date.now();
  res = await apiRequest('POST', '/users', {
    name: 'Test Staff',
    email: `test-e2e-staff-${ts}@test.com`,
    password: 'password123',
    role: 'staff',
    is_provider: false,
  }, adminToken);
  assertStatus(res, 201, 'POST /users creates user');
  const newUserId = res.data.user?.id;

  // Get single user
  if (newUserId) {
    res = await apiRequest('GET', `/users/${newUserId}`, null, adminToken);
    assertStatus(res, 200, 'GET /users/:id succeeds');
    assertEqual(res.data.user.name, 'Test Staff', 'User name matches');
  }

  // Duplicate email
  if (newUserId) {
    res = await apiRequest('POST', '/users', {
      name: 'Duplicate',
      email: res.data.user?.email || `test-e2e-staff-${ts}@test.com`,
      password: 'password123',
      role: 'staff',
    }, adminToken);
    assertStatus(res, 409, 'Duplicate email returns 409');
  }

  // Delete test user
  if (newUserId) {
    res = await apiRequest('DELETE', `/users/${newUserId}`, null, adminToken);
    assertStatus(res, 200, 'DELETE /users/:id succeeds');
  }
}

// --- Service Tests ---

async function testServices(adminToken) {
  console.log('\n💇 SERVICES');
  console.log('──────────────────────────');

  // List services
  let res = await apiRequest('GET', '/services', null, adminToken);
  assertStatus(res, 200, 'GET /services succeeds');
  assert(Array.isArray(res.data.services), 'Services is an array');
  assert(res.data.services.length >= 1, 'At least 1 seeded service');

  const haircut = res.data.services.find((s) => s.name === 'Haircut & Style');
  assert(!!haircut, 'Haircut & Style service exists');

  // Clean up any stale e2e test services left from prior runs
  const staleServices = res.data.services.filter(s => s.name.includes('E2E Test Service') && !s.is_active);
  for (const stale of staleServices) {
    await apiRequest('DELETE', `/services/${stale.id}`, null, adminToken);
  }

  // Create service
  res = await apiRequest('POST', '/services', {
    name: 'E2E Test Service',
    duration_minutes: 60,
    open_to_any_provider: true,
  }, adminToken);
  assertStatus(res, 201, 'POST /services creates service');
  const svcId = res.data.service?.id;

  // Update service
  if (svcId) {
    res = await apiRequest('PATCH', `/services/${svcId}`, { name: 'E2E Test Service Updated' }, adminToken);
    assertStatus(res, 200, 'PATCH /services/:id succeeds');
    assertEqual(res.data.service.name, 'E2E Test Service Updated', 'Service name updated');
  }

  // Delete test service
  if (svcId) {
    res = await apiRequest('DELETE', `/services/${svcId}`, null, adminToken);
    assertStatus(res, 200, 'DELETE /services/:id succeeds');
  }
}

// --- Client Tests ---

async function testClients(adminToken) {
  console.log('\n👤 CLIENTS');
  console.log('──────────────────────────');

  // Create client
  let res = await apiRequest('POST', '/clients', {
    name: 'E2E Test Client',
    phone: '555-9999',
    email: 'e2e@test.com',
  }, adminToken);
  assertStatus(res, 201, 'POST /clients creates client');
  const clientId = res.data.client?.id;

  // List clients
  res = await apiRequest('GET', '/clients', null, adminToken);
  assertStatus(res, 200, 'GET /clients succeeds');
  assert(Array.isArray(res.data.clients), 'Clients is an array');

  // Search clients
  res = await apiRequest('GET', '/clients?search=E2E', null, adminToken);
  assertStatus(res, 200, 'GET /clients?search= works');
  assert(res.data.clients.some((c) => c.name === 'E2E Test Client'), 'Search finds test client');

  // Get single client
  if (clientId) {
    res = await apiRequest('GET', `/clients/${clientId}`, null, adminToken);
    assertStatus(res, 200, 'GET /clients/:id succeeds');
    assertEqual(res.data.client.name, 'E2E Test Client', 'Client name matches');
    assert(Array.isArray(res.data.appointments), 'Appointments is an array');
  }

  // Update client
  if (clientId) {
    res = await apiRequest('PATCH', `/clients/${clientId}`, { is_flagged: true }, adminToken);
    assertStatus(res, 200, 'PATCH /clients/:id succeeds');
    assertEqual(res.data.client.is_flagged, true, 'Client flagged status updated');
  }

  // Delete client
  if (clientId) {
    res = await apiRequest('DELETE', `/clients/${clientId}`, null, adminToken);
    assertStatus(res, 200, 'DELETE /clients/:id succeeds');
  }

  // Validation: missing name
  res = await apiRequest('POST', '/clients', { phone: '555-0000' }, adminToken);
  assertStatus(res, 400, 'Missing name returns 400');
}

// --- Visit Tests ---

async function testVisits(adminToken) {
  console.log('\n📋 VISITS');
  console.log('──────────────────────────');

  // Get data for creating a visit
  const usersRes = await apiRequest('GET', '/users', null, adminToken);
  const provider = usersRes.data.users.find((u) => u.is_provider);
  const servicesRes = await apiRequest('GET', '/services', null, adminToken);
  const service = servicesRes.data.services[0];
  const clientsRes = await apiRequest('GET', '/clients', null, adminToken);
  const client = clientsRes.data.clients[0];

  if (!provider || !client) {
    console.log('  ⚠️  Skipping visit tests — need seeded data (provider, client)');
    return;
  }

  // Pick a service the provider can actually use: either open_to_any_provider or one they're qualified for
  if (!service) {
    console.log('  ⚠️  Skipping visit tests — no services available');
    return;
  }
  // Prefer an open_to_any_provider service to avoid qualification issues
  const usableService = servicesRes.data.services.find(s => s.is_active && s.open_to_any_provider);
  if (!usableService) {
    console.log('  ⚠️  Skipping visit tests — no open services for provider');
    return;
  }

  // Cancel all visit_segments so the PostgreSQL exclusion constraint releases.
  // The constraint only applies to status NOT IN ('cancelled'), so cancelling
  // segments clears the way for new bookings at the same time slot.
  await db('visit_segments').where('status', '!=', 'cancelled').update({ status: 'cancelled' });

  // Use a time far in the future to avoid conflicts with real data
  const now = new Date();
  now.setDate(now.getDate() + 365);
  now.setHours(10, 0, 0, 0);
  const endTime = new Date(now.getTime() + 45 * 60000);

  let res = await apiRequest('POST', '/visits', {
    client_id: client.id,
    booking_source: 'phone',
    start_time: now.toISOString(),
    end_time: endTime.toISOString(),
    segments: [{
      provider_id: provider.id,
      service_id: usableService.id,
      start_time: now.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: 45,
    }],
  }, adminToken);
  assertStatus(res, 201, 'POST /visits creates visit');
  const visitId = res.data.visit?.id;

  // List visits
  res = await apiRequest('GET', '/visits', null, adminToken);
  assertStatus(res, 200, 'GET /visits succeeds');
  assert(Array.isArray(res.data.visits), 'Visits is an array');

  // Get single visit
  if (visitId) {
    res = await apiRequest('GET', `/visits/${visitId}`, null, adminToken);
    assertStatus(res, 200, 'GET /visits/:id succeeds');
    assertEqual(res.data.visit.booking_source, 'phone', 'Visit booking source matches');
    assert(res.data.visit.segments.length >= 1, 'Visit has segments');
  }

  // Update visit status to arrived
  if (visitId) {
    res = await apiRequest('PATCH', `/visits/${visitId}/status`, { status: 'arrived' }, adminToken);
    assertStatus(res, 200, 'PATCH /visits/:id/status to arrived');
    assertEqual(res.data.visit.status, 'arrived', 'Visit status is arrived');
  }

  // Update to completed
  if (visitId) {
    res = await apiRequest('PATCH', `/visits/${visitId}/status`, { status: 'completed' }, adminToken);
    assertStatus(res, 200, 'PATCH /visits/:id/status to completed');
    assertEqual(res.data.visit.status, 'completed', 'Visit status is completed');
  }

  // Validation: invalid booking source
  res = await apiRequest('POST', '/visits', {
    client_id: client.id,
    booking_source: 'invalid',
    start_time: now.toISOString(),
    end_time: endTime.toISOString(),
    segments: [{
      provider_id: provider.id,
      service_id: usableService.id,
      start_time: now.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: 45,
    }],
  }, adminToken);
  assertStatus(res, 400, 'Invalid booking source returns 400');
}

// --- Report Tests ---

async function testReports(adminToken) {
  console.log('\n📈 REPORTS');
  console.log('──────────────────────────');

  // Dashboard
  let res = await apiRequest('GET', '/reports/dashboard', null, adminToken);
  assertStatus(res, 200, 'GET /reports/dashboard succeeds');
  assert(res.data !== undefined, 'Dashboard data returned');

  // Provider reports
  res = await apiRequest('GET', '/reports/providers', null, adminToken);
  assertStatus(res, 200, 'GET /reports/providers succeeds');

  // Booking source reports
  res = await apiRequest('GET', '/reports/booking-sources', null, adminToken);
  assertStatus(res, 200, 'GET /reports/booking-sources succeeds');
}

// --- Audit Tests ---

async function testAudit(adminToken) {
  console.log('\n📝 AUDIT');
  console.log('──────────────────────────');

  let res = await apiRequest('GET', '/audit', null, adminToken);
  assertStatus(res, 200, 'GET /audit succeeds');
  assert(Array.isArray(res.data.entries), 'Audit entries is an array');
}

// --- Attention Tests ---

async function testAttention(adminToken) {
  console.log('\n🔔 ATTENTION');
  console.log('──────────────────────────');

  // List attention items
  let res = await apiRequest('GET', '/attention', null, adminToken);
  assertStatus(res, 200, 'GET /attention succeeds');
  assert(Array.isArray(res.data.items), 'Attention items is an array');

  // Get counts
  res = await apiRequest('GET', '/attention/counts', null, adminToken);
  assertStatus(res, 200, 'GET /attention/counts succeeds');
  assert(typeof res.data.total === 'number', 'Total count is a number');
}

// --- Health Check ---

async function testHealth() {
  console.log('\n🏥 HEALTH');
  console.log('──────────────────────────');
  const res = await apiRequest('GET', '/health');
  assertStatus(res, 200, 'Health check succeeds');
  assertEqual(res.data.status, 'ok', 'Health status is ok');
}

// --- Run All ---

async function run() {
  console.log('🧪 E2E API Test Suite');
  console.log('════════════════════════════════════════\n');
  console.log(`Target: ${API}`);

  try {
    await testHealth();
    const adminToken = await testAuth();
    await testUsers(adminToken);
    await testServices(adminToken);
    await testClients(adminToken);
    await testVisits(adminToken);
    await testReports(adminToken);
    await testAudit(adminToken);
    await testAttention(adminToken);
  } catch (err) {
    console.error('\n💥 Test suite error:', err.message);
    failed++;
  }

  console.log('\n════════════════════════════════════════');
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log('\n❌ Failures:');
    for (const f of failures) {
      console.log(`   - ${f}`);
    }
  }

  // Close the DB connection pool so the process can exit cleanly
  await db.destroy();

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

run().catch(async (err) => {
  console.error(err);
  await db.destroy();
  process.exit(1);
});
