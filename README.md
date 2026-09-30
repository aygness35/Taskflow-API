# TaskFlow API

TaskFlow, ekiplerin çalışma alanları, projeler ve görevler üzerinden iş takibini yönetmesini sağlayan bir REST API uygulamasıdır.

Backend tarafı **NestJS, TypeScript, Prisma ve SQLite** kullanılarak geliştirilmiştir. Frontend ayrı bir React + TypeScript uygulaması olarak API ile haberleşir.

## Özellikler

- Kullanıcı kayıt, giriş, token yenileme ve çıkış işlemleri
- JWT tabanlı kimlik doğrulama
- Çalışma alanı ve ekip üyesi yönetimi
- Proje oluşturma, düzenleme ve silme
- Görev oluşturma, düzenleme ve silme
- Görev atama, durum ve öncelik yönetimi
- Görev yorumları
- Görev arama, filtreleme, sıralama ve sayfalama
- Proje takvimi ve tarih aralığına göre görev sorgulama
- Alt görevler ve tekrarlanan görevler
- Görev etiketleri, kontrol listeleri ve aktivite geçmişi
- Arşiv ve çöp kutusu işlemleri
- Görevleri CSV olarak dışa aktarma
- E-posta davet akışı
- Atama ve yorum bildirimleri
- Yaklaşan ve geciken görevler için otomatik hatırlatmalar
- Çalışma alanı genelinde arama
- Çalışma alanı durum, öncelik ve ekip ilerleme raporları
- Görevlere dosya ekleme
- Swagger API dokümantasyonu
- E2E testleri
- Optimistic concurrency kontrolü

## Kullanılan Teknolojiler

- **NestJS**
- **TypeScript**
- **Prisma ORM**
- **SQLite**
- **JWT**
- **Swagger / OpenAPI**
- **Jest**
- **Supertest**

## Proje Yapısı

```text
Taskflow_API/
├── src/        # API modülleri ve uygulama kodları
├── prisma/     # Veritabanı şeması, migration'lar ve seed
├── test/       # E2E testleri
└── scripts/    # Kurulum ve yardımcı scriptler
```

## Gereksinimler

- Node.js 22 LTS
- npm

SQLite kullanıldığı için ayrıca bir veritabanı sunucusu kurulması gerekmez.

## Kurulum

Projeyi klonladıktan sonra ana klasörde:

```bash
npm ci
npm run setup
npx prisma migrate deploy
npm run start:dev
```

API varsayılan olarak:

```text
http://localhost:3000
```

adresinde çalışır.

Swagger dokümantasyonu:

```text
http://localhost:3000/api/docs
```

Windows PowerShell'de `npm` veya `npx` komutları engellenirse `npm.cmd` ve `npx.cmd` kullanılabilir.

## API'yi Deneme

Swagger arayüzünden API uç noktaları doğrudan test edilebilir.

Temel kullanım akışı:

1. `POST /auth/register` ile hesap oluştur.
2. `POST /auth/login` ile giriş yap.
3. Dönen `accessToken` değerini Swagger'daki **Authorize** alanında kullan.
4. `POST /workspaces` ile çalışma alanı oluştur.
5. Çalışma alanında proje oluştur.
6. Projeye görev ekle.

Örnek kayıt isteği:

```json
{
  "name": "Deniz",
  "email": "deniz@example.com",
  "password": "GucluSifre1!"
}
```

Örnek görev:

```json
{
  "title": "Giriş ekranını kontrol et"
}
```

## Seed Verileri

Yerel geliştirme ortamında örnek veriler oluşturmak için:

```bash
npm run seed
```

komutu kullanılabilir.

Seed işlemi aşağıdaki örnek kullanıcıları oluşturur:

| E-posta             | Şifre            | Rol    |
| ------------------- | ---------------- | ------ |
| `alice@example.com` | `TaskFlowDemo1!` | OWNER  |
| `bob@example.com`   | `TaskFlowDemo1!` | MEMBER |

Bu hesaplar yalnızca yerel geliştirme ve test amacıyla kullanılmalıdır.

## Yetkilendirme

Kullanıcılar yalnızca üyesi oldukları çalışma alanlarına erişebilir.

- OWNER ve ADMIN proje yönetimi yapabilir.
- Tüm üyeler görev oluşturabilir ve güncelleyebilir.
- Görevi oluşturan kişi veya yöneticiler görevleri silebilir.
- Yorumları yalnızca yazarı düzenleyebilir.
- Yorumları yazarı veya yöneticiler silebilir.
- Çalışma alanını yalnızca OWNER silebilir.

Görev durumları:

```text
TODO
IN_PROGRESS
IN_REVIEW
DONE
```

Öncelikler:

```text
LOW
MEDIUM
HIGH
URGENT
```

## API Tasarım Notları

Tüm API uç noktaları Swagger üzerinde dokümante edilmiştir.

API rotalarının başında `/api` prefix'i bulunmaz.

### Optimistic Concurrency

Çalışma alanı, proje, görev, görev ataması ve yorum güncellemelerinde `expectedUpdatedAt` kullanılır.

İstemci, son okuduğu kaydın `updatedAt` değerini güncelleme isteğinde gönderir:

```http
PATCH /tasks/<task-id>
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "status": "DONE",
  "expectedUpdatedAt": "2026-09-25T12:00:00.000Z"
}
```

Görev silme işleminde değer sorgu parametresi olarak gönderilir:

```http
DELETE /tasks/<task-id>?expectedUpdatedAt=2026-09-25T12%3A00%3A00.000Z
Authorization: Bearer <accessToken>
```

Gönderilen `expectedUpdatedAt` güncel değilse API `409 Conflict` döndürür ve işlem gerçekleştirilmez.

Bu mekanizma, aynı kaydın farklı kullanıcılar tarafından eş zamanlı değiştirilmesi durumunda eski verinin yanlışlıkla üzerine yazılmasını önlemeye yardımcı olur.

## Görev ve Takvim Özellikleri

API, görevlerin tarih bilgileri üzerinden takvim görünümünün desteklenmesini sağlar.

Takvim sorguları en fazla **62 günlük** bir tarih aralığını kabul eder.

Tekrarlanan görevler:

- `DAILY`
- `WEEKLY`
- `MONTHLY`

değerlerini destekler.

Bir tekrarlanan görev tamamlandığında API bir sonraki görevi otomatik olarak oluşturabilir.

## Dosya Ekleri

Görevlere aşağıdaki dosya türleri eklenebilir:

- PNG
- JPG
- PDF
- TXT
- DOCX
- XLSX

Dosya boyutu sınırı **5 MB**'dır.

Geliştirme ortamında dosya ekleri SQLite veritabanında saklanır. Production ortamında nesne depolama ve dosya güvenliği ayrıca yapılandırılmalıdır.

## Ortam Değişkenleri

Yerel ayarlar `.env` dosyasında tutulur. Başlangıç değerleri `.env.example` dosyasında bulunur.

Temel değişkenler:

| Değişken             | Açıklama                        |
| -------------------- | ------------------------------- |
| `PORT`               | API portu                       |
| `DATABASE_URL`       | SQLite veritabanı bağlantısı    |
| `JWT_SECRET`         | Access token anahtarı           |
| `JWT_REFRESH_SECRET` | Refresh token anahtarı          |
| `CORS_ORIGINS`       | İzin verilen frontend adresleri |
| `NODE_ENV`           | Çalışma ortamı                  |

Gerçek `.env` dosyası ve veritabanı dosyası repoya eklenmemelidir.

## Test ve Build

Testleri çalıştırmak için:

```bash
npm test
```

E2E testleri:

```bash
npm run test:e2e
```

Build:

```bash
npm run build
```

Format kontrolü:

```bash
npm run format:check
```

Production build'i çalıştırmak için:

```bash
npm run build
npm start
```

E2E testleri ayrı bir geçici SQLite veritabanı kullanır.

## Frontend

TaskFlow frontend'i ayrı bir repository olarak geliştirilmiştir.

Frontend tarafında:

- React
- TypeScript
- Vite

kullanılır.

Frontend, backend API ile HTTP istekleri üzerinden haberleşir.

## Geliştirme Notları

TaskFlow, ekip içi proje ve görev yönetimi senaryolarını uygulamalı olarak geliştirmek amacıyla hazırlanmıştır.

Backend ve frontend ayrı servisler olarak çalışır. Yerel geliştirme ortamında backend varsayılan olarak `3000`, frontend ise `3001` portunu kullanır.

Production kullanımı için HTTPS, kalıcı veritabanı depolaması, yedekleme, güvenlik ve dosya depolama yapılandırmaları ayrıca yapılmalıdır.

Henüz desteklenmeyen bazı özellikler:

- Şifre sıfırlama
- E-posta doğrulama
- Çalışma alanı sahipliği devri
