# Medusa V2 Backend & Admin (Tek Konteyner)

Medusa V2 backend ve Admin UI'ı tek bir Docker konteynerinde çalıştıran, self-healing yapıya sahip proje.

## 🚀 Hızlı Başlangıç

1.  `.env.example` dosyasını `.env` olarak kopyalayıp yapılandırın
2.  Başlatın:
    ```bash
    docker compose up -d --build
    ```
3.  Erişim:
    *   **Admin Panel:** [http://localhost:7001/app](http://localhost:7001/app)
    *   **Backend API:** [http://localhost:7001](http://localhost:7001)

## 🏗️ Mimari

Tek konteyner (`hobby-backend`) — Port 7001 üzerinden hem API hem Admin UI sunulur.
Nginx veya ayrı bir admin servisi yoktur. Medusa'nın kendi tasarımına uygundur.

## 🔧 Komutlar

```bash
# Kullanıcı oluştur
docker exec -it hobby-backend npx medusa user --email admin@example.com --password secret

# Logları izle
docker logs -f hobby-backend

# Yeniden başlat
docker compose restart
```
