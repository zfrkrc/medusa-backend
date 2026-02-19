# Medusa V2 Optimized Backend & Admin

Bu proje, Medusa V2 backend ve Admin UI bileşenlerini ayrıştırılmış, yüksek performanslı ve geliştirme dostu (self-healing) bir Docker yapısıyla sunar.

## 🚀 Hızlı Başlangıç

1.  **Bağımlılıklar:** Docker ve Docker Compose'un kurulu olduğundan emin olun.
2.  **Yapılandırma:** `.env.example` dosyasını `.env` olarak kopyalayın ve gerekli bilgileri doldurun.
3.  **Başlatma:**
    ```powershell
    docker compose up -d --build
    ```
4.  **Erişim:**
    *   **Admin Panel:** [http://localhost:9000](http://localhost:9000)
    *   **Backend API:** [http://localhost:7001](http://localhost:7001)

## 🏗️ Mimari Yapı

Bu kurulum iki ana servisten oluşur:

1.  **Backend (`hobby-backend`):** Node.js 20 tabanlı, `medusa start` komutuyla çalışan ana API sunucusu.
2.  **Admin UI (`hobby-admin`):** Medusa Admin bileşenlerini önceden build eden ve **Nginx** (Port 9000) üzerinden sunan statik servis. Bu yapı, backend yükünü azaltır ve admin panelinin çok daha hızlı yüklenmesini sağlar.

## 🛡️ Gizlilik ve Güvenlik (Privacy)

*   **Hassas Veriler:** Şifreler, API anahtarları ve secret'lar asla Docker imajlarına gömülmez. Sadece `.env` dosyası üzerinden çalışma anında (runtime) veya build argümanı olarak iletilir.
*   **Git Koruması:** `.gitignore` ve `.dockerignore` dosyaları, hassas verilerin yanlışlıkla versiyon sistemine veya Docker Hub'a yüklenmesini önlemek için yapılandırılmıştır.
*   **İzole Ağ:** Servisler `hobby-network` adı verilen izole bir Docker ağı üzerinden haberleşir.

## 🔧 Bakım ve Komutlar

### Yeni Kullanıcı Oluşturma
```powershell
docker exec -it hobby-backend npx medusa user --email admin@example.com --password secret_password
```

### Logları İzleme
```powershell
docker logs -f hobby-backend
```

Daha detaylı bilgi için [DOCUMENTATION.md](./DOCUMENTATION.md) dosyasını inceleyebilirsiniz.
