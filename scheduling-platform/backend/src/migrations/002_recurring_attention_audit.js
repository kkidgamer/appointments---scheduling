/**
 * Migration 002: Recurring series, needs attention, audit log
 */

exports.up = async function (knex) {
  // --- Recurrence type enum ---
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE recurrence_type AS ENUM ('weekly', 'every_n_weeks', 'monthly_date', 'monthly_weekday');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE attention_severity AS ENUM ('urgent', 'informational');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE attention_status AS ENUM ('open', 'resolved', 'dismissed');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  // --- Visit Series (recurring template) ---
  await knex.schema.createTable('visit_series', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.uuid('client_id').notNullable().references('id').inTable('clients');
    t.uuid('booked_by').notNullable().references('id').inTable('users');
    t.specificType('booking_source', 'booking_source').notNullable();

    // Recurrence config
    t.specificType('recurrence_type', 'recurrence_type').notNullable();
    t.jsonb('recurrence_config').notNullable();
    // weekly: { day_of_week: 3 }
    // every_n_weeks: { day_of_week: 3, n: 2 }
    // monthly_date: { day_of_month: 15 }
    // monthly_weekday: { weekday: 4, week_number: 3 } (e.g., 3rd Thursday)

    t.date('start_date').notNullable();
    t.date('end_date'); // null = ongoing
    t.integer('max_occurrences'); // null = ongoing
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // --- Visit Series Versions ---
  // When admin edits "this and all future", a new version is created
  await knex.schema.createTable('visit_series_versions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('series_id').notNullable().references('id').inTable('visit_series').onDelete('CASCADE');
    t.integer('version_number').notNullable().defaultTo(1);

    // Template segments for this version
    t.jsonb('template_segments').notNullable();
    // [{ provider_id, service_id, duration_minutes }]

    t.jsonb('template_meta'); // { start_time: "10:00", notes: "..." }
    t.timestamps(true, true);
    t.unique(['series_id', 'version_number']);
  });

  // --- Visit Series Occurrences ---
  await knex.schema.createTable('visit_series_occurrences', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('series_id').notNullable().references('id').inTable('visit_series').onDelete('CASCADE');
    t.uuid('series_version_id').notNullable().references('id').inTable('visit_series_versions');
    t.integer('occurrence_number').notNullable();
    t.date('occurrence_date').notNullable();
    t.uuid('visit_id').references('id').inTable('visits');
    t.boolean('is_exception').notNullable().defaultTo(false);
    t.jsonb('exception_data'); // { provider_changes: [...], service_changes: [...], time_change: ... }
    t.timestamps(true, true);
    t.unique(['series_id', 'occurrence_number']);
  });

  // Link visits back to series
  await knex.schema.raw(`
    ALTER TABLE visits
    ADD CONSTRAINT fk_visits_series
    FOREIGN KEY (series_id) REFERENCES visit_series(id) ON DELETE SET NULL
  `);

  // --- Needs Attention Queue ---
  await knex.schema.createTable('attention_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.specificType('severity', 'attention_severity').notNullable().defaultTo('informational');
    t.specificType('status', 'attention_status').notNullable().defaultTo('open');

    // What kind of issue
    t.string('issue_type').notNullable();
    // 'conflict', 'qualification_mismatch', 'availability_change', 'series_at_risk', 'client_flag'

    t.string('title').notNullable();
    t.text('description');

    // References to affected entities
    t.uuid('visit_id').references('id').inTable('visits').onDelete('SET NULL');
    t.uuid('series_id').references('id').inTable('visit_series').onDelete('SET NULL');
    t.uuid('provider_id').references('id').inTable('users').onDelete('SET NULL');
    t.uuid('client_id').references('id').inTable('clients').onDelete('SET NULL');

    // Resolution
    t.text('resolution_notes');
    t.uuid('resolved_by').references('id').inTable('users');
    t.timestamp('resolved_at');

    t.timestamps(true, true);
  });

  await knex.schema.raw(`
    CREATE INDEX idx_attention_business_status ON attention_items (business_id, status);
    CREATE INDEX idx_attention_business_severity ON attention_items (business_id, severity, status);
  `);

  // --- Audit Log ---
  await knex.schema.createTable('audit_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('action').notNullable(); // 'create', 'update', 'delete', 'status_change'
    t.string('entity_type').notNullable(); // 'visit', 'client', 'user', 'service', etc.
    t.uuid('entity_id');
    t.jsonb('old_values');
    t.jsonb('new_values');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.raw(`
    CREATE INDEX idx_audit_business ON audit_log (business_id, created_at DESC);
    CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS audit_log CASCADE');
  await knex.raw('DROP TABLE IF EXISTS attention_items CASCADE');
  await knex.raw('DROP TABLE IF EXISTS visit_series_occurrences CASCADE');
  await knex.raw('DROP TABLE IF EXISTS visit_series_versions CASCADE');
  await knex.raw('DROP TABLE IF EXISTS visit_series CASCADE');
  await knex.raw('DROP TYPE IF EXISTS attention_status CASCADE');
  await knex.raw('DROP TYPE IF EXISTS attention_severity CASCADE');
  await knex.raw('DROP TYPE IF EXISTS recurrence_type CASCADE');
};
