# TaskFlow API

Ekiplerin çalışma alanı, proje ve görevlerini yönetmesi için hazırlanmış bir REST API. NestJS, TypeScript, Prisma ve SQLite kullanır. Bu depo yalnızca backend'i içerir; API'yi Swagger veya Postman üzerinden deneyebilirsin.

## Kurulum

Node.js 22 LTS ve npm gerekir. SQLite kullandığı için ayrıca veritabanı sunucusu kurmana gerek yok.

Projeyi indirdikten sonra ana klasörde çalıştır:

```sh
npm ci
npm run setup
npx prisma migrate deploy
npm run start:dev
```

`setup`, gerekli `.env` dosyasını ve JWT anahtarlarını oluşturur; mevcut ayarları ve veritabanını korur.

- API: http://localhost:3000
- Swagger: http://localhost:3000/api/docs

Windows PowerShell, `npm` veya `npx` komutunu engellerse `npm.cmd` ve `npx.cmd` kullanabilirsin.

## API'yi deneme

1. Swagger sayfasını aç.
2. `POST /auth/register` ile hesap oluştur veya `POST /auth/login` ile giriş yap.
3. Yanıttaki `accessToken` değerini kopyalayıp **Authorize** alanına yapıştır.
4. `POST /workspaces` ile çalışma alanı oluştur.
5. Dönen çalışma alanı kimliğiyle `POST /workspaces/{workspaceId}/projects` üzerinden proje ekle.
6. Proje kimliğiyle `POST /projects/{projectId}/tasks` üzerinden görev oluştur.

Kayıt için örnek istek gövdesi:

```json
{
  "name": "Deniz",
  "email": "deniz@example.com",
  "password": "GucluSifre1!"
}
```

Görev oluşturmak için başlık yeterlidir:

```json
{
  "title": "Giriş ekranını kontrol et"
}
```

Hazır verilerle denemek istersen ayrı bir terminalde `npm run seed` çalıştır. Örnek çalışma alanı ve görevlerle birlikte şu hesaplar oluşturulur:

| E-posta             | Şifre            | Rol    |
| ------------------- | ---------------- | ------ |
| `alice@example.com` | `TaskFlowDemo1!` | OWNER  |
| `bob@example.com`   | `TaskFlowDemo1!` | MEMBER |

Bu hesaplar yalnızca yerel deneme içindir.

## Özellikler

- Kayıt, giriş, token yenileme ve çıkış.
- Çalışma alanı ve üye yönetimi.
- Proje ve görev oluşturma, düzenleme ve silme.
- Görev atama, durum ve öncelik değiştirme.
- Yorum ekleme, düzenleme ve silme.
- Görevlerde arama, filtreleme, sıralama ve sayfalama.
- Proje takvimi ve tarih aralığına göre görev sorgulama.
- Görev etiketleri, kontrol listeleri ve aktivite geçmişi.
- Alt görevler ve günlük, haftalık veya aylık tekrarlanan görevler.
- Görevleri arşive veya çöp kutusuna taşıma ve geri yükleme.
- Çalışma alanı görevlerini CSV olarak dışa aktarma.
- Süresi dolan, tek kullanımlık bağlantılarla e-posta daveti akışı.
- Atama ve yorum bildirimleri ile okunma takibi.
- Son tarihi 24 saat içinde olan ve geciken görevler için otomatik hatırlatmalar.
- Proje, görev, yorum ve ekip üyelerini kapsayan çalışma alanı genelinde arama.
- Çalışma alanı durum, öncelik ve ekip ilerleme raporları.
- Görevlere 5 MB'a kadar PNG, JPG, PDF, TXT, DOCX ve XLSX dosyası ekleme.

Kullanıcılar yalnızca üyesi oldukları çalışma alanlarına erişebilir. Projeleri OWNER ve ADMIN yönetir; tüm üyeler görev oluşturabilir ve güncelleyebilir. Görevleri oluşturan kişi veya yöneticiler silebilir. Yorumları yalnızca yazarı düzenleyebilir; yazarı veya yöneticiler silebilir. Çalışma alanını yalnızca OWNER silebilir; bu işlem bağlı projeleri, görevleri ve yorumları da siler.

Görev durumları: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`.
Öncelikler: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.

Tüm uç noktalar ve istek alanları Swagger'da bulunur. API rotalarının başında `/api` yoktur.

Takvim uç noktası en fazla 62 günlük bir aralık kabul eder. Dosya ekleri SQLite
veritabanında saklanır; canlı ortamda nesne depolama ve dosya taraması ayrıca
yapılandırılmalıdır.

## Ayarlar

Yerel ayarlar `.env` dosyasındadır. Başlangıç değerleri `.env.example` içinde bulunur.

| Değişken             | Kullanımı                                             |
| -------------------- | ----------------------------------------------------- |
| `PORT`               | API portu; varsayılan `3000`                          |
| `DATABASE_URL`       | SQLite dosyası; varsayılan `file:./dev.db`            |
| `JWT_SECRET`         | Erişim tokenı anahtarı; setup oluşturur               |
| `JWT_REFRESH_SECRET` | Ayrı yenileme tokenı anahtarı; setup oluşturur        |
| `CORS_ORIGINS`       | API'ye tarayıcıdan bağlanmasına izin verilen adresler |
| `NODE_ENV`           | `development`, `test` veya `production`               |

Veriler `prisma/dev.db` dosyasında saklanır. `.env` ve veritabanını paylaşma; projeyi alan kişi kurulum komutlarıyla kendi dosyalarını oluşturabilir.

## Kullanım notları

- Erişim tokenı 15 dakika, yenileme tokenı 7 gün geçerlidir. Yenileme işleminde dönen yeni tokenı kullan; eski token tekrar kullanılamaz. Çıkıştan sonra erişim tokenı süresi dolana kadar geçerli kalır.
- Görev listesinde `search`, `status`, `priority`, `assigneeId`, `page`, `limit`, `sortBy` ve `sortOrder` kullanılabilir. Varsayılan sayfa boyutu 20, en yüksek değer 100'dür.
- Tarihleri saat dilimiyle gönder: `2099-01-01T12:00:00+03:00`. Yanıtlar UTC kullanır. Yeni görevin bitiş tarihi geçmişte olamaz.
- Tekrarlanan bir görev tamamlandığında API sıradaki görevi otomatik oluşturur. Tekrar seçenekleri `DAILY`, `WEEKLY` ve `MONTHLY` değerleridir.
- Arşivlenen ve çöp kutusuna taşınan görevler normal proje listelerinde gösterilmez. Çöp kutusundaki bir görev kalıcı olarak silinebilir.
- Davet uç noktası 7 gün geçerli bir bağlantı üretir. Frontend bu bağlantıyı kopyalama veya kullanıcının e-posta uygulamasında gönderme seçeneklerini sunar.
- Hatırlatıcı servis dakikada bir çalışır. Aynı görev ve son tarih için yaklaşan/geciken bildirimi yalnızca bir kez üretir; görev atanmamışsa bildirimi görevi oluşturan kullanıcı alır.
- Çalışma alanı, proje, görev, görev ataması ve yorum güncellemelerinde `expectedUpdatedAt` zorunludur. Son okuduğun kaydın `updatedAt` değerini istek gövdesine ekle. Aynı kaynakları silerken bu değeri sorgu parametresi olarak gönder. Eksik/geçersiz değer 400, başka bir düzenlemeden dolayı eski kalan değer 409 döndürür; işlem yapılmaz. Profil ve üyelik işlemleri bu sürüm sözleşmesine dahil değildir.
- Şifre sıfırlama, e-posta doğrulama ve çalışma alanı sahipliği devri henüz yoktur.

## Düzenleme ve silme örneği

Önce detay veya liste yanıtından kaydın `updatedAt` değerini al. Görevi güncellerken:

```http
PATCH /tasks/<gorev-id>
Authorization: Bearer <accessToken>
Content-Type: application/json

{"status":"DONE","expectedUpdatedAt":"2026-09-25T12:00:00.000Z"}
```

Görevi silerken:

```http
DELETE /tasks/<gorev-id>?expectedUpdatedAt=2026-09-25T12%3A00%3A00.000Z
Authorization: Bearer <accessToken>
```

Örnekteki tarihi sabit kullanma; sunucudan aldığın güncel değeri gönder. Sorgu parametresini `URLSearchParams` gibi bir araçla kodla. Başarılı güncellemenin döndürdüğü yeni `updatedAt` değerini sakla. 409 alırsan kaydı yeniden gösterip kullanıcıdan değişikliği incelemesini iste; otomatik olarak yeni sürümle tekrar yazma veya silme yapma. Bu alanı göndermeyen eski istemcilerin güncellenmesi gerekir.

Sürüm yalnızca ilgili kaydı korur. Çalışma alanı/proje silme işlemi alt kayıtları da sildiği için arayüzde ayrıca açık bir silme onayı gösterilmelidir; üst kaydın sürümü, alt kayıtların tüm değişikliklerini temsil etmez.

## Test ve derleme

```sh
npm test
npm run test:e2e
npm run build
npm run format:check
```

E2E testleri ayrı geçici SQLite veritabanında çalışır; mevcut verilerini değiştirmez.

Bağımlılıkların bilinen güvenlik açıklarını kontrol etmek için `npm audit` çalıştırılabilir. Prisma 6.19'un yapılandırma bağımlılıklarındaki güvenlik düzeltmeleri için `package.json` içinde `deepmerge-ts` 8.0.0 ve `effect` 3.20.0 sürümleri `overrides` ile sabitlenmiştir. Prisma güncellenirken bu sabitlemelerin hâlâ gerekli olup olmadığı kontrol edilmelidir.

Derlenmiş uygulamayı çalıştırmak için:

```sh
npm run build
npm start
```

## Klasörler

- `src/`: API modülleri, yetkilendirme ve doğrulama kodları.
- `prisma/`: Veritabanı şeması, migration'lar ve örnek veriler.
- `test/`: Uçtan uca testler.
- `scripts/`: Kurulum ve test yardımcıları.

Canlı ortam için HTTPS, kalıcı veritabanı depolaması ve yedekleme ayrıca yapılandırılmalıdır. Mevcut SQLite ve bellekte tutulan istek sınırı yapısı tek uygulama örneği için tasarlanmıştır.
