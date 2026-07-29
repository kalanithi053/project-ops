UPDATE "ticket_status"
SET "id" = gen_random_uuid()::text
WHERE "id" LIKE 'removed-%';
