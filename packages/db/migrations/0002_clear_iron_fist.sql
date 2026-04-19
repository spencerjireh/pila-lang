CREATE TABLE IF NOT EXISTS "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"device_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "push_tokens_scope_enum" CHECK ("push_tokens"."scope" IN ('guest_party','host_session')),
	CONSTRAINT "push_tokens_platform_enum" CHECK ("push_tokens"."platform" IN ('ios','android'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_push_tokens_unique_live" ON "push_tokens" USING btree ("scope_id","device_token") WHERE "push_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_push_tokens_tenant" ON "push_tokens" USING btree ("tenant_id");