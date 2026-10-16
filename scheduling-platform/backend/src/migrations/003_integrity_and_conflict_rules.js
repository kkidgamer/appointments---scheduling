/**
 * Migration 003: enforce tenant boundaries and booking conflict rules.
 *
 * Legacy rows are retained. The constraints intentionally fail the migration
 * if earlier data contains cross-business relationships or overlapping client
 * visits, so those rows can be reviewed instead of silently rewritten.
 */

exports.up = async function (knex) {
  // Name the occurrence link by its actual role: resolved conflicts can move
  // the visit while it remains the appointment produced by this occurrence.
  await knex.schema.alterTable('visit_series_occurrences', (t) => {
    t.renameColumn('visit_id', 'resulting_appointment_id');
  });

  // Composite unique keys let foreign keys prove that related records belong
  // to the same business, even when an application query forgets to scope.
  for (const table of ['users', 'service_categories', 'services', 'clients', 'visits', 'visit_series']) {
    await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_business_id_id_unique UNIQUE (business_id, id)`);
  }

  // The visit client and creator must belong to the visit's tenant.
  await knex.raw(`
    ALTER TABLE visits
      ADD CONSTRAINT visits_client_same_business_fk
        FOREIGN KEY (business_id, client_id) REFERENCES clients (business_id, id),
      ADD CONSTRAINT visits_booker_same_business_fk
        FOREIGN KEY (business_id, booked_by) REFERENCES users (business_id, id),
      ADD CONSTRAINT visits_valid_window CHECK (end_time > start_time)
  `);

  // Categories and services are tenant-local.
  await knex.raw(`
    ALTER TABLE services
      ADD CONSTRAINT services_category_same_business_fk
        FOREIGN KEY (business_id, category_id) REFERENCES service_categories (business_id, id)
  `);

  // Add tenant ownership to the qualification join and derive it from the
  // provider. Composite FKs then prevent cross-business qualifications.
  await knex.schema.alterTable('provider_services', (t) => {
    t.uuid('business_id');
  });
  await knex.raw(`
    UPDATE provider_services ps
      SET business_id = u.business_id
      FROM users u
      WHERE u.id = ps.user_id
  `);
  await knex.raw(`
    ALTER TABLE provider_services
      ALTER COLUMN business_id SET NOT NULL,
      ADD CONSTRAINT provider_services_business_fk
        FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
      ADD CONSTRAINT provider_services_user_same_business_fk
        FOREIGN KEY (business_id, user_id) REFERENCES users (business_id, id) ON DELETE CASCADE,
      ADD CONSTRAINT provider_services_service_same_business_fk
        FOREIGN KEY (business_id, service_id) REFERENCES services (business_id, id) ON DELETE CASCADE,
      ADD CONSTRAINT provider_services_business_user_service_unique
        UNIQUE (business_id, user_id, service_id)
  `);

  // A segment's visit, provider, and service must all share its tenant.
  await knex.raw(`
    ALTER TABLE visit_segments
      ADD CONSTRAINT visit_segments_visit_same_business_fk
        FOREIGN KEY (business_id, visit_id) REFERENCES visits (business_id, id) ON DELETE CASCADE,
      ADD CONSTRAINT visit_segments_provider_same_business_fk
        FOREIGN KEY (business_id, provider_id) REFERENCES users (business_id, id),
      ADD CONSTRAINT visit_segments_service_same_business_fk
        FOREIGN KEY (business_id, service_id) REFERENCES services (business_id, id),
      ADD CONSTRAINT visit_segments_valid_window CHECK (end_time > start_time),
      ADD CONSTRAINT visit_segments_positive_duration CHECK (duration_minutes > 0)
  `);

  // Provider schedules are also tenant-local and only belong to users in the
  // same business. A provider is still represented by the user + is_provider.
  await knex.raw(`
    ALTER TABLE provider_availability
      ADD CONSTRAINT provider_availability_user_same_business_fk
        FOREIGN KEY (business_id, user_id) REFERENCES users (business_id, id) ON DELETE CASCADE
  `);
  await knex.raw(`
    ALTER TABLE provider_exceptions
      ADD CONSTRAINT provider_exceptions_user_same_business_fk
        FOREIGN KEY (business_id, user_id) REFERENCES users (business_id, id) ON DELETE CASCADE
  `);

  // Recurring templates and their generated visits may not cross tenants.
  await knex.raw(`
    ALTER TABLE visit_series
      ADD CONSTRAINT visit_series_client_same_business_fk
        FOREIGN KEY (business_id, client_id) REFERENCES clients (business_id, id),
      ADD CONSTRAINT visit_series_booker_same_business_fk
        FOREIGN KEY (business_id, booked_by) REFERENCES users (business_id, id)
  `);
  await knex.raw(`
    ALTER TABLE visits
      ADD CONSTRAINT visits_series_same_business_fk
        FOREIGN KEY (business_id, series_id) REFERENCES visit_series (business_id, id)
  `);

  // Provider conflicts are blocked unless an admin explicitly records the
  // override on that segment. Cancelled segments never reserve provider time.
  await knex.schema.alterTable('visit_segments', (t) => {
    t.boolean('conflict_override').notNullable().defaultTo(false);
  });
  await knex.raw('ALTER TABLE visit_segments DROP CONSTRAINT IF EXISTS exclude_segment_overlap');
  await knex.raw(`
    ALTER TABLE visit_segments
      ADD CONSTRAINT exclude_segment_overlap
      EXCLUDE USING gist (
        provider_id WITH =,
        tsrange(start_time, end_time, '[)') WITH &&
      ) WHERE (status <> 'cancelled' AND conflict_override = false)
  `);

  // A client may not hold two overlapping visits, regardless of provider or
  // visit source. Half-open ranges allow one visit to start as another ends.
  await knex.raw(`
    ALTER TABLE visits
      ADD CONSTRAINT exclude_client_visit_overlap
      EXCLUDE USING gist (
        client_id WITH =,
        tsrange(start_time, end_time, '[)') WITH &&
      ) WHERE (status <> 'cancelled')
  `);

  // Keep provider qualification lookup tenant-scoped and efficient.
  await knex.raw('CREATE INDEX idx_provider_services_business_user ON provider_services (business_id, user_id)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_provider_services_business_user');
  await knex.raw('ALTER TABLE visits DROP CONSTRAINT IF EXISTS exclude_client_visit_overlap');
  await knex.raw('ALTER TABLE visit_segments DROP CONSTRAINT IF EXISTS exclude_segment_overlap');
  await knex.raw(`
    ALTER TABLE visit_segments
      ADD CONSTRAINT exclude_segment_overlap
      EXCLUDE USING gist (
        provider_id WITH =,
        tstzrange(start_time, end_time) WITH &&
      ) WHERE (status <> 'cancelled')
  `);
  await knex.schema.alterTable('visit_segments', (t) => t.dropColumn('conflict_override'));
  await knex.raw(`
    ALTER TABLE visit_segments
      DROP CONSTRAINT IF EXISTS visit_segments_service_same_business_fk,
      DROP CONSTRAINT IF EXISTS visit_segments_provider_same_business_fk,
      DROP CONSTRAINT IF EXISTS visit_segments_visit_same_business_fk,
      DROP CONSTRAINT IF EXISTS visit_segments_positive_duration,
      DROP CONSTRAINT IF EXISTS visit_segments_valid_window
  `);
  await knex.raw('ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_series_same_business_fk');
  await knex.raw(`
    ALTER TABLE visit_series
      DROP CONSTRAINT IF EXISTS visit_series_booker_same_business_fk,
      DROP CONSTRAINT IF EXISTS visit_series_client_same_business_fk
  `);
  await knex.raw('ALTER TABLE provider_exceptions DROP CONSTRAINT IF EXISTS provider_exceptions_user_same_business_fk');
  await knex.raw('ALTER TABLE provider_availability DROP CONSTRAINT IF EXISTS provider_availability_user_same_business_fk');
  await knex.raw(`
    ALTER TABLE provider_services
      DROP CONSTRAINT IF EXISTS provider_services_business_user_service_unique,
      DROP CONSTRAINT IF EXISTS provider_services_service_same_business_fk,
      DROP CONSTRAINT IF EXISTS provider_services_user_same_business_fk,
      DROP CONSTRAINT IF EXISTS provider_services_business_fk
  `);
  await knex.schema.alterTable('provider_services', (t) => t.dropColumn('business_id'));
  await knex.raw('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_category_same_business_fk');
  await knex.raw(`
    ALTER TABLE visits
      DROP CONSTRAINT IF EXISTS visits_valid_window,
      DROP CONSTRAINT IF EXISTS visits_booker_same_business_fk,
      DROP CONSTRAINT IF EXISTS visits_client_same_business_fk
  `);
  for (const table of ['users', 'service_categories', 'services', 'clients', 'visits', 'visit_series']) {
    await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_business_id_id_unique`);
  }
  await knex.schema.alterTable('visit_series_occurrences', (t) => {
    t.renameColumn('resulting_appointment_id', 'visit_id');
  });
};
