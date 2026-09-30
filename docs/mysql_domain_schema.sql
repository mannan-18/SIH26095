-- SecureSight MySQL domain persistence blueprint.
-- The active MVP uses Drizzle to manage the domain_records envelope.
-- A later normalized deployment may split these entities into dedicated tables.

CREATE TABLE domain_records (
  recordKey VARCHAR(160) PRIMARY KEY,
  entity VARCHAR(48) NOT NULL,
  recordId VARCHAR(96) NOT NULL,
  payload JSON NOT NULL,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Geofence distance is calculated with the application-level Haversine
-- implementation in server/secureEngine.ts for consistent behavior.
