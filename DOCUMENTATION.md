# Teknik Dökümantasyon

Bu belge, projenin teknik detaylarını, Docker konfigürasyonlarını ve geliştirme akışını açıklar.

## 1. Docker Yapılandırması

### Self-Healing (Kendi Kendini Onaran) Mekanizma
Backend konteyneri (`Dockerfile.backend`), her başlatıldığında şunları kontrol eder:
*   `node_modules` klasörü yoksa `yarn install` çalıştırır.
*   Build çıktıları (`.medusa/server`) yoksa `yarn build` çalıştırır.
*   Son olarak `npx medusa start` ile sistemi ayağa kaldırır.

Bu yapı sayesinde yerelde klasörleri silseniz bile konteyner kendini tamir ederek açılır.

### Volume Stratejisi
*   `./my-medusa-store:/app/my-medusa-store`: Kaynak kodlar anlık olarak konteyner ile senkronize edilir.
*   `/app/my-medusa-store/node_modules`: Anonymous volume kullanılarak imaj içindeki paketler host makinesinden (Windows) bağımsız ve güvenli tutulur.
*   `hobby_uploads`: Ürün görselleri gibi yüklemeler için kalıcı depolama alanı sağlar.

## 2. Port Yönetimi

| Servis | İç Port | Dış Port (Host) | Görev |
| :--- | :--- | :--- | :--- |
| Backend | 7001 | 7001 | Medusa API & Business Logic |
| Admin UI | 9000 | 9000 | Nginx tabanlı Admin Arayüzü |

**Not:** Admin UI artık port 80 yerine port 9000'de dinleyecek şekilde konfigüre edilmiştir.

## 3. CORS ve Yetkilendirme
Admin panelinin backend ile konuşabilmesi için `.env` dosyasındaki `ADMIN_CORS` ve `AUTH_CORS` ayarları şu şekilde olmalıdır:
`http://localhost:9000,http://127.0.0.1:9000`

## 4. Geliştirme İpuçları
*   **Yarn Kullanımı:** Proje Yarn Berry (v2+) uyumludur. Konteyner içinde `corepack enable` komutu ile Yarn özellikleri aktifleştirilir.
*   **Build Context:** Docker build işlemi, hız ve güvenlik için `c:\Kodlar\medusa-backend` dizinini context olarak kullanır. `.dockerignore` sayesinde sadece gerekli dosyalar Docker daemon'a gönderilir.

## 5. Sorun Giderme
*   **Failed to Fetch:** Admin panelinde bu hatayı alıyorsanız, tarayıcıda `localhost:7001` yerine mutlaka `localhost:9000` kullandığınızdan emin olun.
*   **Module Not Found:** Eğer bir paket eksik hatası alırsanız, `docker compose up --build` yaparak imajı yenileyin.
