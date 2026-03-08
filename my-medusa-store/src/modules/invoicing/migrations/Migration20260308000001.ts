import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260308000001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "invoice" (
        "id"                  text not null,
        "order_id"            text not null,
        "provider"            text not null,
        "provider_invoice_id" text null,
        "invoice_number"      text null,
        "invoice_type"        text not null,
        "status"              text not null default 'draft',
        "amount"              numeric null,
        "currency"            text null,
        "pdf_url"             text null,
        "issued_at"           timestamptz null,
        "error_message"       text null,
        "created_at"          timestamptz not null default now(),
        "updated_at"          timestamptz not null default now(),
        "deleted_at"          timestamptz null,
        constraint "invoice_pkey" primary key ("id")
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_invoice_order_id" ON "invoice" ("order_id");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_invoice_deleted_at" ON "invoice" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "invoice" cascade;`)
  }
}
