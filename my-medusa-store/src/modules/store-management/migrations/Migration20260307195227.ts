import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260307195227 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "admin_user_store" ("id" text not null, "email" text not null, "role" text check ("role" in ('super_admin', 'store_admin')) not null, "store_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "admin_user_store_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_admin_user_store_deleted_at" ON "admin_user_store" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "store_tenant" ("id" text not null, "name" text not null, "handle" text not null, "domain" text null, "publishable_key_id" text null, "sales_channel_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "store_tenant_pkey" primary key ("id"));`);
    this.addSql(`alter table "store_tenant" add column if not exists "sales_channel_id" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_tenant_deleted_at" ON "store_tenant" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "admin_user_store" cascade;`);

    this.addSql(`drop table if exists "store_tenant" cascade;`);
  }

}
