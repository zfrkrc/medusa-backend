-- ============================================================
-- Tüm test müşterilerini temizle (Medusa V2)
-- Çalıştır: psql $DATABASE_URL -f clean-customers.sql
-- ============================================================

-- Önce bağlı provider identity'leri sil
DELETE FROM provider_identity
WHERE auth_identity_id IN (
  SELECT ai.id FROM auth_identity ai
  JOIN customer c ON ai.entity_id = c.id
  WHERE ai.entity_id IS NOT NULL
);

-- Auth identity'leri sil
DELETE FROM auth_identity
WHERE entity_id IN (SELECT id FROM customer);

-- Adresleri sil
DELETE FROM customer_address
WHERE customer_id IN (SELECT id FROM customer);

-- Müşterileri sil
DELETE FROM customer;

SELECT 'Tüm müşteriler temizlendi.' AS result;
