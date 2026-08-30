/**
 * Migration 001: Initial Schema
 * 
 * Tables:
 *   businesses, users, service_categories, services, provider_services,
 *   clients, visits, visit_segments, provider_availability,
 *   provider_exceptions, business_closures
 * 
 * Includes multi-tenant business_id scoping, UUID PKs,
 * and a PostgreSQL exclusion constraint for segment conflict detection.
 */

exports.up = async function (knex) {
  // Enable UUID extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // --- Custom ENUM types ---
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('owner', 'admin', 'staff');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE booking_source AS ENUM ('walk_in', 'whatsapp', 'instagram', 'phone', 'contact_form', 'other');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE visit_status AS ENUM ('booked', 'arrived', 'completed', 'no_show', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE segment_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  // --- Businesses ---
  await knex.schema.createTable('businesses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('phone');
    t.string('email');
    t.text('address');
    t.string('timezone').notNullable().defaultTo('UTC');
    t.jsonb('standard_hours').notNullable().defaultTo('{}');
    // standard_hours shape: { "mon": { "start": "09:00", "end": "18:00" }, ... }
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true); // created_at, updated_at
  });

  // --- Users ---
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.string('email').notNullable();
    t.string('password_hash').notNullable();
    t.string('name').notNullable();
    t.string('phone');
    t.specificType('role', 'user_role').notNullable().defaultTo('staff');
    t.boolean('is_provider').notNullable().defaultTo(false);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['business_id', 'email']);
  });

  // --- Service Categories ---
  await knex.schema.createTable('service_categories', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.string('name').notNullable();
    t.text('description');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.unique(['business_id', 'name']);
  });

  // --- Services ---
  await knex.schema.createTable('services', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.uuid('category_id').references('id').inTable('service_categories').onDelete('SET NULL');
    t.string('name').notNullable();
    t.text('description');
    t.integer('duration_minutes').notNullable().defaultTo(30);
    t.boolean('is_active').notNullable().defaultTo(true);
    // If open_to_any_provider is false, only providers in provider_services can be assigned
    t.boolean('open_to_any_provider').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // --- Provider Services (qualification link) ---
  // Maps which services a provider is qualified to perform
  // Only relevant when service.open_to_any_provider = false
  await knex.schema.createTable('provider_services', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('service_id').notNullable().references('id').inTable('services').onDelete('CASCADE');
    t.timestamps(true, true);
    t.unique(['user_id', 'service_id']);
  });

  // --- Clients ---
  await knex.schema.createTable('clients', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('phone').notNullable();
    t.string('email');
    t.integer('no_show_count').notNullable().defaultTo(0);
    t.integer('cancellation_count').notNullable().defaultTo(0);
    t.boolean('is_flagged').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

  await knex.schema.raw(`
    CREATE INDEX idx_clients_business_phone ON clients (business_id, phone);
    CREATE INDEX idx_clients_business_name ON clients (business_id, name);
  `);

  // --- Visits (multi-segment visit parent) ---
  await knex.schema.createTable('visits', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.uuid('client_id').notNullable().references('id').inTable('clients');
    t.uuid('booked_by').notNullable().references('id').inTable('users');
    t.specificType('booking_source', 'booking_source').notNullable();
    t.timestamp('start_time').notNullable();
    t.timestamp('end_time').notNullable();
    t.specificType('status', 'visit_status').notNullable().defaultTo('booked');
    t.text('cancellation_reason');
    t.text('notes');
    // 24-hour lock: completed_at tracks when the visit was completed
    t.timestamp('completed_at');
    t.boolean('is_locked').notNullable().defaultTo(false);
    // Recurrence link (Phase 5 — nullable now)
    t.uuid('series_id');
    t.integer('occurrence_number');
    t.timestamps(true, true);
  });

  await knex.schema.raw(`
    CREATE INDEX idx_visits_business_start ON visits (business_id, start_time);
    CREATE INDEX idx_visits_business_client ON visits (business_id, client_id);
    CREATE INDEX idx_visits_provider_time ON visits (business_id, start_time, end_time);
  `);

  // --- Visit Segments (the atomic schedulable unit) ---
  await knex.schema.createTable('visit_segments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('visit_id').notNullable().references('id').inTable('visits').onDelete('CASCADE');
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.uuid('provider_id').notNullable().references('id').inTable('users');
    t.uuid('service_id').notNullable().references('id').inTable('services');
    t.timestamp('start_time').notNullable();
    t.timestamp('end_time').notNullable();
    t.integer('duration_minutes').notNullable();
    t.specificType('status', 'segment_status').notNullable().defaultTo('pending');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.raw(`
    CREATE INDEX idx_segments_business_provider_time ON visit_segments (business_id, provider_id, start_time, end_time);
    CREATE INDEX idx_segments_visit ON visit_segments (visit_id);
  `);

  // --- Exclusion constraint for segment conflict detection ---
  // Prevents two segments for the same provider from overlapping in time
  await knex.raw('CREATE EXTENSION IF NOT EXISTS btree_gist');
  await knex.raw(`
    ALTER TABLE visit_segments
    ADD CONSTRAINT exclude_segment_overlap
    EXCLUDE USING gist (
      provider_id WITH =,
      tstzrange(start_time, end_time) WITH &&
    ) WHERE (status NOT IN ('cancelled'));
  `);

  // --- Provider Availability (standard weekly schedule) ---
  await knex.schema.createTable('provider_availability', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.integer('day_of_week').notNullable(); // 0=Sunday, 6=Saturday
    t.time('start_time').notNullable();
    t.time('end_time').notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['user_id', 'day_of_week']);
  });

  // --- Provider Exceptions (day off / schedule override) ---
  await knex.schema.createTable('provider_exceptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.date('exception_date').notNullable();
    t.boolean('is_off').notNullable().defaultTo(true);
    t.time('start_time');
    t.time('end_time');
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['user_id', 'exception_date']);
  });

  // --- Business Closures (holidays / business-wide) ---
  await knex.schema.createTable('business_closures', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.date('closure_date').notNullable();
    t.time('start_time');
    t.time('end_time');
    t.text('reason');
    t.timestamps(true, true);
    t.unique(['business_id', 'closure_date']);
  });
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS business_closures CASCADE');
  await knex.raw('DROP TABLE IF EXISTS provider_exceptions CASCADE');
  await knex.raw('DROP TABLE IF EXISTS provider_availability CASCADE');
  await knex.raw('DROP TABLE IF EXISTS visit_segments CASCADE');
  await knex.raw('DROP TABLE IF EXISTS visits CASCADE');
  await knex.raw('DROP TABLE IF EXISTS clients CASCADE');
  await knex.raw('DROP TABLE IF EXISTS provider_services CASCADE');
  await knex.raw('DROP TABLE IF EXISTS services CASCADE');
  await knex.raw('DROP TABLE IF EXISTS service_categories CASCADE');
  await knex.raw('DROP TABLE IF EXISTS users CASCADE');
  await knex.raw('DROP TABLE IF EXISTS businesses CASCADE');
  await knex.raw('DROP TYPE IF EXISTS segment_status CASCADE');
  await knex.raw('DROP TYPE IF EXISTS visit_status CASCADE');
  await knex.raw('DROP TYPE IF EXISTS booking_source CASCADE');
  await knex.raw('DROP TYPE IF EXISTS user_role CASCADE');
};
