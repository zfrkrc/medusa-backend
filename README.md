# Medusa Turkey Backend

Türkiye e-ticaret pazarı için geliştirilmekte olan modüler Medusa V2 backend.
Her entegrasyon ileride bağımsız bir npm paketine dönüştürülebilecek şekilde tasarlanmıştır.

---

## Mimari Prensipler

- Medusa core'a dokunulmaz
- Her entegrasyon kendi modülü/servisi olarak izole edilir
- Adapter pattern ile dış sağlayıcılar değiştirilebilir
- İleride monorepo plugin ekosistemine dönüşebilecek yapı

---

## Proje Durumu

### ✅ Tamamlananlar

#### address-tr Modülü
Türkiye adres hiyerarşisi — 81 il, ilçe, mahalle, posta kodu.

```
src/modules/address-tr/
  models/index.ts       → TrProvince, TrDistrict, TrNeighborhood
  service.ts
  index.ts
```

**Endpoint'ler:**
```
GET /store/tr/provinces
GET /store/tr/provinces/:province_id/districts
GET /store/tr/districts/:district_id/neighborhoods
```

**Önemli not:** Bu endpoint'ler `pgConnection.raw()` ile çalışır.
`remoteQuery` ve `MedusaService` tabanlı yaklaşım, Medusa 2.12.x sürümünde
`activeManager_` undefined hatası verdiği için devre dışı bırakılmıştır.

---

#### store-management Modülü (Multi-Store / RBAC)
Birden fazla mağazayı tek Medusa instance üzerinde yönetme.

```
src/modules/store-management/
  models/
    store.ts            → Store (sales_channel_id, metadata)
    admin-user.ts       → AdminUser (email → store eşleşmesi)
  service.ts            → getStoreIdForAdmin, isSuperAdmin, findStoreById
  migrations/

src/api/middlewares/
  store-isolation.ts    → Ghost mode: ürün/sipariş/lokasyon/müşteri izolasyonu
  auth-context.ts       → Email çözümleme (cookie + Bearer token)

src/api/admin/store-management/
  stores/               → CRUD
  admins/               → Admin-store eşleştirme
  me/                   → Aktif admin'in mağaza bilgisi
  products/             → İzole ürün listesi
  orders/               → İzole sipariş listesi
  customers/            → İzole müşteri listesi
```

**İzolasyon Matrisi:**

| Kaynak | Strateji |
|--------|----------|
| Ürünler / Siparişler | Sales Channel query filtresi |
| Lokasyonlar / Müşteriler | `metadata.store_id` response filtresi |
| API Keys | Gizli (boş liste) |
| Kullanıcılar | Sadece kendisi |
| Bölgeler / Vergiler | Ortak (dokunulmaz) |

---

#### Cookie Auth Patch
Medusa admin panelinin cookie tabanlı authentication için
`instrumentation.ts` üzerinden uygulanan minimal patch.

---

#### Email Notifications
SMTP tabanlı e-posta bildirimleri (şifre sıfırlama vb.)

```
src/modules/email-notifications/
```

---

#### tax-tr Modülü (İskelet)
```
src/modules/tax-tr/
  service.ts    → KDV %20 / %10 mantığı mevcut
```
> Şu an `medusa-config.ts`'de yorum satırında. Ürün kategorisi bazlı oran desteği eksik.

---

### 🔲 Yapılacaklar

#### Kargo Entegrasyonu
```
src/integrations/shipping/
  provider.interface.ts
  yurtici.provider.ts
  aras.provider.ts
  mng.provider.ts
  hepsijet.provider.ts
  ups.provider.ts

src/services/shipping-service.ts   → dinamik provider seçimi
```

**Hedef interface:**
```typescript
interface ShippingProvider {
  createShipment(order: Order): Promise<Shipment>
  cancelShipment(shipmentId: string): Promise<void>
  getTracking(trackingNumber: string): Promise<TrackingInfo>
  createLabel(shipmentId: string): Promise<Buffer>
}
```

**İleride:** `medusa-plugin-shipping-yurtici`, `medusa-plugin-shipping-aras`

---

#### Ödeme Sağlayıcıları
```
src/integrations/payments/
  iyzico.provider.ts    → 3D Secure + taksit
  paytr.provider.ts
  payu.provider.ts
```

Gereksinimler: 3D Secure, taksit, webhook doğrulama, ödeme durumu sync.

**İleride:** `medusa-plugin-payment-iyzico`

---

#### e-Fatura / e-Arşiv
```
src/integrations/invoicing/
  parasut.provider.ts
  invoice.service.ts
```

Akış:
```
order.completed → invoiceService.generateInvoice() → PDF → admin panel
```

Ek sağlayıcılar: Kolaysoft, Uyumsoft, direkt GİB entegrasyonu.

**İleride:** `medusa-plugin-invoice-parasut`

---

#### tax-tr (Tamamlama)
- Ürün kategorisi bazlı KDV oranı (%1, %10, %20)
- `medusa-config.ts`'de aktif etme
- Medusa tax module interface'e tam uyum

---

#### Admin Widget'lar
- Kargo provider aktif/pasif kontrolü
- Ödeme provider seçimi
- Fatura görüntüleme ve indirme
- Takip numarası gösterimi

---

## Kurulum

### Gereksinimler
- Docker + Docker Compose
- `.env` dosyası (`.env.example`'dan kopyalanır)

### Başlatma
```bash
# İlk kurulum veya kaynak kod değişikliği sonrası
docker compose up -d --build --force-recreate medusa-backend

# Sadece yeniden başlatma
docker compose restart medusa-backend

# Logları izle
docker logs -f hobby-backend
```

### Admin kullanıcı oluşturma
```bash
docker exec -it hobby-backend npx medusa user --email admin@example.com --password secret
```

### Multi-store kurulumu
```bash
docker exec -it hobby-backend npx medusa exec ./src/scripts/setup-multistore.ts
```

---

## API

**Base URL:** `http://localhost:7001`
**Admin Panel:** `http://localhost:7001/app`

### Türkiye Adres API'si (Public)
```
GET /store/tr/provinces
    → { provinces: [{id, name, plate_code}], count }

GET /store/tr/provinces/:province_id/districts
    → { districts: [{id, name}], count }

GET /store/tr/districts/:district_id/neighborhoods
    → { neighborhoods: [{id, name, postal_code}], count }
```
Header: `x-publishable-api-key: <pk_...>`

### Store Management (Admin)
```
GET  /admin/store-management/stores
POST /admin/store-management/stores
GET  /admin/store-management/me
GET  /admin/store-management/admins
POST /admin/store-management/admins
```

---

## Klasör Yapısı

```
my-medusa-store/
  src/
    api/
      middlewares/
        store-isolation.ts
        auth-context.ts
      store/tr/             ← Adres endpoint'leri
      admin/store-management/
    modules/
      address-tr/           ✅ Tamamlandı
      store-management/     ✅ Tamamlandı
      tax-tr/               🔲 İskelet
      email-notifications/  ✅ Tamamlandı
    integrations/           🔲 Henüz başlanmadı
      shipping/
      payments/
      invoicing/
    services/               🔲 Henüz başlanmadı
    scripts/                → Yönetim script'leri
    subscribers/
    workflows/
  Dockerfile.backend
  docker-compose.yml
```

---

## Bilinen Sınırlamalar

- `remoteQuery` ile custom modüller Medusa 2.12.x'te `activeManager_ undefined` hatası veriyor. Adres endpoint'leri bu nedenle `pgConnection.raw()` kullanıyor.
- `tax-tr` modülü aktif değil; medusa-config.ts'de yorum satırında.
- Admin izolasyonu response-filter tabanlı; büyük veri setlerinde performans optimizasyonu gerekebilir.
