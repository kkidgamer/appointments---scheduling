/**
 * Seed script: creates a demo business with users, services, clients, and sample visits.
 * 
 * Usage: node src/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // Test connection
    await db.raw('SELECT 1');
    console.log('✅ Database connected');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await db.raw('TRUNCATE visit_segments, visits, provider_services, provider_exceptions, provider_availability, business_closures, clients, services, service_categories, users, businesses RESTART IDENTITY CASCADE');

    // --- Create Business ---
    const [business] = await db('businesses')
      .insert({
        name: 'Glow Beauty Studio',
        phone: '+1-555-0100',
        email: 'hello@glowbeauty.com',
        address: '123 Main St, Suite 200, Anytown, USA',
        timezone: 'America/New_York',
        standard_hours: {
          mon: { start: '09:00', end: '18:00' },
          tue: { start: '09:00', end: '18:00' },
          wed: { start: '09:00', end: '18:00' },
          thu: { start: '09:00', end: '18:00' },
          fri: { start: '09:00', end: '20:00' },
          sat: { start: '10:00', end: '16:00' },
          sun: null,
        },
        is_active: true,
      })
      .returning('*');
    console.log(`✅ Created business: ${business.name} (${business.id})`);

    // --- Create Users ---
    const passwordHash = await bcrypt.hash('password123', 12);

    const [owner] = await db('users')
      .insert({
        business_id: business.id,
        name: 'Sarah Johnson',
        email: 'sarah@glowbeauty.com',
        password_hash: passwordHash,
        phone: '+1-555-0101',
        role: 'owner',
        is_provider: true,
      })
      .returning('*');
    console.log(`✅ Created owner: ${owner.name} (sarah@glowbeauty.com / password123)`);

    const [admin] = await db('users')
      .insert({
        business_id: business.id,
        name: 'Mike Chen',
        email: 'mike@glowbeauty.com',
        password_hash: passwordHash,
        phone: '+1-555-0102',
        role: 'admin',
        is_provider: false,
      })
      .returning('*');
    console.log(`✅ Created admin: ${admin.name} (mike@glowbeauty.com / password123)`);

    const [stylist1] = await db('users')
      .insert({
        business_id: business.id,
        name: 'Emma Wilson',
        email: 'emma@glowbeauty.com',
        password_hash: passwordHash,
        phone: '+1-555-0103',
        role: 'staff',
        is_provider: true,
      })
      .returning('*');

    const [stylist2] = await db('users')
      .insert({
        business_id: business.id,
        name: 'Lisa Park',
        email: 'lisa@glowbeauty.com',
        password_hash: passwordHash,
        phone: '+1-555-0104',
        role: 'staff',
        is_provider: true,
      })
      .returning('*');

    const [receptionist] = await db('users')
      .insert({
        business_id: business.id,
        name: 'Amy Torres',
        email: 'amy@glowbeauty.com',
        password_hash: passwordHash,
        phone: '+1-555-0105',
        role: 'staff',
        is_provider: false,
      })
      .returning('*');
    console.log(`✅ Created 3 staff members`);

    // --- Create Service Categories ---
    const [hairCat] = await db('service_categories')
      .insert({ business_id: business.id, name: 'Hair', description: 'Hair cutting, styling, coloring', sort_order: 1 })
      .returning('*');

    const [facialCat] = await db('service_categories')
      .insert({ business_id: business.id, name: 'Facial', description: 'Facial treatments and skincare', sort_order: 2 })
      .returning('*');

    const [nailCat] = await db('service_categories')
      .insert({ business_id: business.id, name: 'Nails', description: 'Manicure and pedicure services', sort_order: 3 })
      .returning('*');

    const [massageCat] = await db('service_categories')
      .insert({ business_id: business.id, name: 'Massage', description: 'Massage and relaxation', sort_order: 4 })
      .returning('*');
    console.log('✅ Created 4 service categories');

    // --- Create Services ---
    const [haircut] = await db('services')
      .insert({
        business_id: business.id,
        category_id: hairCat.id,
        name: 'Haircut & Style',
        description: 'Precision cut with blow dry and style',
        duration_minutes: 45,
        open_to_any_provider: true,
      })
      .returning('*');

    const [color] = await db('services')
      .insert({
        business_id: business.id,
        category_id: hairCat.id,
        name: 'Hair Color',
        description: 'Full or partial color application',
        duration_minutes: 90,
        open_to_any_provider: false, // requires qualification
      })
      .returning('*');

    const [facial_basic] = await db('services')
      .insert({
        business_id: business.id,
        category_id: facialCat.id,
        name: 'Classic Facial',
        description: 'Deep cleansing facial treatment',
        duration_minutes: 60,
        open_to_any_provider: false,
      })
      .returning('*');

    const [facial_deep] = await db('services')
      .insert({
        business_id: business.id,
        category_id: facialCat.id,
        name: 'Deep Pore Cleansing',
        description: 'Intensive pore extraction and hydration',
        duration_minutes: 75,
        open_to_any_provider: false,
      })
      .returning('*');

    const [manicure] = await db('services')
      .insert({
        business_id: business.id,
        category_id: nailCat.id,
        name: 'Classic Manicure',
        description: 'Nail shaping, cuticle care, and polish',
        duration_minutes: 30,
        open_to_any_provider: true,
      })
      .returning('*');

    const [pedicure] = await db('services')
      .insert({
        business_id: business.id,
        category_id: nailCat.id,
        name: 'Spa Pedicure',
        description: 'Soak, exfoliate, massage, and polish',
        duration_minutes: 45,
        open_to_any_provider: true,
      })
      .returning('*');

    const [massage_swedish] = await db('services')
      .insert({
        business_id: business.id,
        category_id: massageCat.id,
        name: 'Swedish Massage',
        description: 'Full body relaxation massage',
        duration_minutes: 60,
        open_to_any_provider: false,
      })
      .returning('*');

    const [massage_deep] = await db('services')
      .insert({
        business_id: business.id,
        category_id: massageCat.id,
        name: 'Deep Tissue Massage',
        description: 'Targeted pressure for muscle tension',
        duration_minutes: 60,
        open_to_any_provider: false,
      })
      .returning('*');
    console.log('✅ Created 8 services');

    // --- Qualify providers ---
    await db('provider_services').insert([
      // Owner (Sarah) — does everything
      { user_id: owner.id, service_id: haircut.id },
      { user_id: owner.id, service_id: color.id },
      { user_id: owner.id, service_id: facial_basic.id },
      { user_id: owner.id, service_id: facial_deep.id },
      // Emma — hair + color
      { user_id: stylist1.id, service_id: haircut.id },
      { user_id: stylist1.id, service_id: color.id },
      // Lisa — facial + massage
      { user_id: stylist2.id, service_id: facial_basic.id },
      { user_id: stylist2.id, service_id: facial_deep.id },
      { user_id: stylist2.id, service_id: massage_swedish.id },
      { user_id: stylist2.id, service_id: massage_deep.id },
    ]);
    console.log('✅ Qualified providers for services');

    // --- Set provider availability ---
    for (const provider of [owner, stylist1, stylist2]) {
      await db('provider_availability').insert([
        { user_id: provider.id, business_id: business.id, day_of_week: 1, start_time: '09:00', end_time: '18:00' },
        { user_id: provider.id, business_id: business.id, day_of_week: 2, start_time: '09:00', end_time: '18:00' },
        { user_id: provider.id, business_id: business.id, day_of_week: 3, start_time: '09:00', end_time: '18:00' },
        { user_id: provider.id, business_id: business.id, day_of_week: 4, start_time: '09:00', end_time: '18:00' },
        { user_id: provider.id, business_id: business.id, day_of_week: 5, start_time: '09:00', end_time: '20:00' },
        { user_id: provider.id, business_id: business.id, day_of_week: 6, start_time: '10:00', end_time: '16:00' },
      ]);
    }
    console.log('✅ Set provider availability');

    // --- Create Clients ---
    const [client1] = await db('clients')
      .insert({
        business_id: business.id,
        name: 'Anna Martinez',
        phone: '+1-555-1001',
        email: 'anna@example.com',
      })
      .returning('*');

    const [client2] = await db('clients')
      .insert({
        business_id: business.id,
        name: 'Rachel Kim',
        phone: '+1-555-1002',
        email: 'rachel@example.com',
      })
      .returning('*');

    const [client3] = await db('clients')
      .insert({
        business_id: business.id,
        name: 'Jessica Brown',
        phone: '+1-555-1003',
        no_show_count: 2,
        is_flagged: true,
      })
      .returning('*');

    const [client4] = await db('clients')
      .insert({
        business_id: business.id,
        name: 'Tom Davis',
        phone: '+1-555-1004',
        email: 'tom@example.com',
      })
      .returning('*');

    const [client5] = await db('clients')
      .insert({
        business_id: business.id,
        name: 'Maria Garcia',
        phone: '+1-555-1005',
      })
      .returning('*');
    console.log('✅ Created 5 clients');

    // --- Create Sample Visits ---
    // Today's date at 9am
    const today = new Date();
    today.setHours(9, 0, 0, 0);

    // Visit 1: Anna — haircut with Emma (today 9:00-9:45)
    const [visit1] = await db('visits')
      .insert({
        business_id: business.id,
        client_id: client1.id,
        booked_by: admin.id,
        booking_source: 'phone',
        start_time: new Date(today),
        end_time: new Date(today.getTime() + 45 * 60000),
        status: 'booked',
      })
      .returning('*');

    await db('visit_segments').insert({
      visit_id: visit1.id,
      business_id: business.id,
      provider_id: stylist1.id,
      service_id: haircut.id,
      start_time: new Date(today),
      end_time: new Date(today.getTime() + 45 * 60000),
      duration_minutes: 45,
    });

    // Visit 2: Rachel — facial with Lisa + manicure with Amy (today 10:00-11:15)
    const v2Start = new Date(today);
    v2Start.setHours(10, 0, 0, 0);
    const [visit2] = await db('visits')
      .insert({
        business_id: business.id,
        client_id: client2.id,
        booked_by: admin.id,
        booking_source: 'whatsapp',
        start_time: v2Start,
        end_time: new Date(v2Start.getTime() + 75 * 60000),
        status: 'booked',
      })
      .returning('*');

    await db('visit_segments').insert([
      {
        visit_id: visit2.id,
        business_id: business.id,
        provider_id: stylist2.id,
        service_id: facial_basic.id,
        start_time: v2Start,
        end_time: new Date(v2Start.getTime() + 60 * 60000),
        duration_minutes: 60,
      },
      {
        visit_id: visit2.id,
        business_id: business.id,
        provider_id: owner.id,
        service_id: manicure.id,
        start_time: new Date(v2Start.getTime() + 15 * 60000), // starts 15 min after facial
        end_time: new Date(v2Start.getTime() + 45 * 60000),
        duration_minutes: 30,
      },
    ]);

    // Visit 3: Jessica — massage with Lisa (today 14:00-15:00) — flagged client
    const v3Start = new Date(today);
    v3Start.setHours(14, 0, 0, 0);
    const [visit3] = await db('visits')
      .insert({
        business_id: business.id,
        client_id: client3.id,
        booked_by: admin.id,
        booking_source: 'instagram',
        start_time: v3Start,
        end_time: new Date(v3Start.getTime() + 60 * 60000),
        status: 'booked',
      })
      .returning('*');

    await db('visit_segments').insert({
      visit_id: visit3.id,
      business_id: business.id,
      provider_id: stylist2.id,
      service_id: massage_swedish.id,
      start_time: v3Start,
      end_time: new Date(v3Start.getTime() + 60 * 60000),
      duration_minutes: 60,
    });

    // Visit 4: Tom — walk-in haircut with Sarah (today 11:30-12:15)
    const v4Start = new Date(today);
    v4Start.setHours(11, 30, 0, 0);
    const [visit4] = await db('visits')
      .insert({
        business_id: business.id,
        client_id: client4.id,
        booked_by: admin.id,
        booking_source: 'walk_in',
        start_time: v4Start,
        end_time: new Date(v4Start.getTime() + 45 * 60000),
        status: 'arrived',
      })
      .returning('*');

    await db('visit_segments').insert({
      visit_id: visit4.id,
      business_id: business.id,
      provider_id: owner.id,
      service_id: haircut.id,
      start_time: v4Start,
      end_time: new Date(v4Start.getTime() + 45 * 60000),
      duration_minutes: 45,
    });

    console.log('✅ Created 4 sample visits with segments\n');
    console.log('🎉 Seed complete!');
    console.log('\n📋 Login credentials:');
    console.log('   Owner:   sarah@glowbeauty.com / password123');
    console.log('   Admin:   mike@glowbeauty.com / password123');
    console.log('   Stylist: emma@glowbeauty.com / password123');
    console.log('   Stylist: lisa@glowbeauty.com / password123');
    console.log('   Staff:   amy@glowbeauty.com / password123');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

seed();
