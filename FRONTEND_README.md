# TaskFlow — Frontend geliştiricisi için başlangıç

Bu projede API, veritabanı işlemleri, giriş sistemi ve yetki kontrolleri backend'de bulunuyor. Senin geliştireceğin site, bu API'ye istek gönderip sonuçları kullanıcıya gösterecek. Veritabanına doğrudan bağlanman veya backend kodunu frontend'e kopyalaman gerekmiyor.

Bu dosya **neyi nereye koyacağını ve hangi ekranda kullanacağını** anlatır. Bütün alanların türleri, doğrulama kuralları ve 31 API işleminin ayrıntısı [FRONTEND_HANDOFF.md](./FRONTEND_HANDOFF.md) içinde. Backend kurulumunun asıl kaynağı [README.md](./README.md).

## 1. Projeleri nereye koymalısın?

Frontend'i ayrı bir klasörde veya ayrı bir depoda geliştir. Örnek yerleşim:

```text
calisma-klasorun/
├── taskflow-api/           # Bu backend deposunun kaynakları
│   ├── package.json
│   ├── src/
│   ├── prisma/
│   └── .env               # Backend'e özel yerel ayarlar
└── taskflow-web/           # Senin oluşturacağın frontend
    ├── package.json
    └── src/
```

Bunlar önerilen klasör adlarıdır. Backend komutlarını `src/`, `prisma/` ve backend `package.json` dosyasının birlikte bulunduğu kökte çalıştır. Backend'in `.env`, veritabanı, `node_modules` veya `dist` klasörlerini frontend'e taşıma.

## 2. Önce API'yi çalıştır

Node.js 22 LTS ve npm kurulu olmalı. Backend klasöründe:

```sh
npm ci
npm run setup
npx prisma migrate deploy
npm run start:dev
```

Bu terminal açık kalsın. API adresi `http://localhost:3000`, deneme ekranı `http://localhost:3000/api/docs` olur. PowerShell komut çalıştırmayı engellerse `npm.cmd` ve `npx.cmd` kullanabilirsin.

Frontend'i kendi geliştirme komutuyla ayrı terminalde başlat. Örneğin frontend'in adresini `http://localhost:3001` seçersen backend `.env` dosyasındaki izin şu adresi içermeli:

```dotenv
CORS_ORIGINS=http://localhost:3001
```

Başka portta çalışıyorsan o adresi yaz ve backend'i yeniden başlat. Protokol, alan adı ve port aynı olmalı; `localhost` ile `127.0.0.1` farklı origin sayılır. Frontend yapılandırmasında API temel adresini `http://localhost:3000` olarak belirle. Yapılandırma değişkeninin adı kullandığın frontend aracına bağlıdır; backend'deki JWT anahtarlarını frontend ayarlarına koyma.

GitHub deposunu paylaşmak API'yi internette çalıştırmaz. `localhost` herkesin kendi bilgisayarıdır. Yerelde kendi API'ni çalıştırabilir veya daha sonra yayınlanan API adresini kullanabilirsin.

## 3. Frontend içinde hangi dosya ne işe yarayacak?

Aşağıdaki yapı öneridir; hazır frontend dosyaları değildir. React, Vue veya başka bir araç kullanabilirsin. Sayfa ve bileşen uzantılarını seçtiğin araca göre belirle.

```text
src/
├── config.ts
├── api/
│   ├── client.ts
│   ├── auth.ts
│   ├── users.ts
│   ├── workspaces.ts
│   ├── projects.ts
│   ├── tasks.ts
│   └── comments.ts
├── types/
│   └── api.ts
├── auth/
│   └── session.ts
├── pages/
│   ├── Login/
│   ├── Register/
│   ├── Profile/
│   ├── Workspaces/
│   ├── WorkspaceSettings/
│   ├── Members/
│   ├── Projects/
│   ├── ProjectDetail/
│   └── TaskDetail/
├── components/
│   ├── TaskForm/
│   ├── TaskFilters/
│   ├── CommentList/
│   └── ConfirmDelete/
└── utils/
    ├── dates.ts
    └── permissions.ts
```

| Dosya/klasör           | Buraya ne koyacaksın?                                                   | Nerede kullanılacak?                                         |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `config.ts`            | Ortama göre API temel adresi                                            | `api/client.ts`                                              |
| `api/client.ts`        | Ortak HTTP isteği, Bearer başlığı, hata gövdesini okuma, 204 kontrolü   | Bütün API dosyaları                                          |
| `api/auth.ts`          | Kayıt, giriş, token yenileme, çıkış çağrıları                           | Giriş/kayıt ekranları ve oturum yönetimi                     |
| `api/users.ts`         | Profil getirme ve ad güncelleme                                         | Profil ekranı, kullanıcı menüsü                              |
| `api/workspaces.ts`    | Alan ve üyelik çağrıları                                                | Alan seçimi, ayarlar, üye ekranı                             |
| `api/projects.ts`      | Proje listeleme ve CRUD çağrıları                                       | Proje listesi ve proje ayarları                              |
| `api/tasks.ts`         | Görev listesi, filtreler, CRUD, atama                                   | Proje içindeki görev listesi/pano ve görev detayı            |
| `api/comments.ts`      | Yorum listeleme ve CRUD çağrıları                                       | Görev detayındaki yorum bölümü                               |
| `types/api.ts`         | API modelleri, istek tipleri, enum değerleri, `Page<T>`                 | API dosyaları, formlar ve ekranlar                           |
| `auth/session.ts`      | Güncel kullanıcı/tokenlar, tek ortak yenileme işlemi, çıkışta temizleme | Uygulama açılışı ve korumalı ekranlar                        |
| `pages/`               | Veriyi yükleme, ekran durumu, kullanıcı işlemlerini bağlama             | Uygulamanın sayfaları                                        |
| `components/`          | Tekrar kullanılan form/liste/onay bileşenleri                           | Sayfalar; veriyi ve işlem fonksiyonlarını dışarıdan alabilir |
| `utils/dates.ts`       | Yerel tarih gösterimi ve API'ye ISO tarih hazırlama                     | Son tarih formu, oluşturma/güncelleme tarihleri              |
| `utils/permissions.ts` | Mevcut alan rolüne göre düğme görünürlüğü                               | Proje/üye/silme işlemleri; son karar backend'indir           |

Akış şöyle olmalı: **Kullanıcı düğmeye basar → sayfa API fonksiyonunu çağırır → ortak istemci isteği gönderir → sayfa sonucu veya hatayı gösterir.** API adreslerini her bileşenin içine ayrı ayrı yazma.

## 4. Hangi ekran hangi API'yi kullanacak?

Buradaki `:id` ifadelerinin yerine API'nin döndürdüğü gerçek kimlikleri koy.

| Ekran/bölüm             | Açılışta yükle                                                      | Kullanıcı işlem yaptığında                                                        |
| ----------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Kayıt                   | Veri yüklemek gerekmez                                              | `POST /auth/register`: `name`, `email`, `password`                                |
| Giriş                   | Geçerli oturum varsa kullanıcıyı kontrol et                         | `POST /auth/login`: `email`, `password`                                           |
| Profil                  | `GET /users/me`                                                     | `PATCH /users/me`: `name`                                                         |
| Alan seçimi             | `GET /workspaces`                                                   | `POST /workspaces`: `name`; seçilen alanın `id` değerini sakla                    |
| Alan ayarları           | `GET /workspaces/:id` ve `/workspaces/:id/members`                  | Alanı PATCH ile düzenle, OWNER ise DELETE ile sil                                 |
| Üyeler                  | `GET /workspaces/:id/members`                                       | Aynı yola POST ile `email`, `role`; `/members/:memberId` yoluna PATCH veya DELETE |
| Proje listesi           | `GET /workspaces/:workspaceId/projects`                             | Aynı yola POST ile proje oluştur; detay için proje `id` değerini kullan           |
| Proje detayı / görevler | `GET /projects/:id`, `GET /projects/:projectId/tasks`, alan üyeleri | Projeyi PATCH/DELETE; görev listesi yoluna POST ile görev oluştur                 |
| Görev detayı            | `GET /tasks/:id`, `GET /tasks/:taskId/comments`                     | Görevi PATCH/DELETE; `/tasks/:id/assign` ile atama                                |
| Yorum bölümü            | Görevin yorum listesi                                               | Liste yoluna POST; `/comments/:id` yoluna PATCH/DELETE                            |
| Çıkış düğmesi           | —                                                                   | `POST /auth/logout`: güncel `refreshToken`                                        |

Proje detayındaki görev listesi için atanan kişi seçeneklerini alan üye listesinden doldur. Görev yanıtında atanan kişinin adı değil `assigneeId` vardır. Yorumda da yazarın adı değil `authorId` vardır; üyelerin `userId` alanıyla eşleştir. Kişi artık üye değilse adı bulunamayabilir; boş veya yanlış kişi göstermek yerine “Eski üye” gibi bir yedek metin kullan.

## 5. Giriş yaptıktan sonra ne olacak?

1. Giriş/kayıt yanıtından `accessToken` ve `refreshToken` al. Yanıtın içinde kullanıcı profili bulunmaz.
2. Korumalı çağrılarda `Authorization: Bearer <accessToken>` gönder.
3. `GET /auth/me` ile kullanıcıyı, `GET /workspaces` ile alanları yükle.
4. Alan seçilince üyeleri getir. `member.userId === currentUser.id` olan kaydın `role` değeri o alandaki yetkidir.
5. Korumalı çağrı 401 dönerse `/auth/refresh` ile bir kez yenilemeyi dene. Aynı anda tek yenileme isteği çalıştır; diğer istekler onu beklesin.
6. Yenileme başarılıysa **iki tokenı da değiştir**, ilk isteği en fazla bir kez tekrar et. Eski refresh token tekrar kullanılamaz.
7. Refresh 401 dönerse oturumu temizleyip giriş ekranına git. Ağ hatasını otomatik olarak “oturum bitti” sayma. 403'te token yenileme yapma.

Token saklama tercihi frontend'de verilmelidir; backend hazır cookie oturumu sağlamıyor. İlk yerel entegrasyonda bellekte tutarsan sayfa yenilenince yeniden giriş gerekir. Kalıcı oturum tasarımını ayrıca kararlaştır. Tokenları URL'ye veya loglara yazma. Çıkışta kullanıcıya ait önbelleği de temizle; ağ hatasında sunucudaki iptalin doğrulanmadığını hesaba kat.

## 6. Bir görevi oluşturma, düzenleme ve silme örneği

Aşağıdaki kod **HTTP mantığını gösteren parça örnektir**. `apiBaseUrl`, `accessToken`, `projectId` ve `task` uygulamandan gelir. Ortak istemciyi kurunca hata işleme ve başlıkları `api/client.ts` içine taşı; burada token yenileme uygulanmamıştır.

### Oluşturma: görev formundaki Kaydet düğmesi

```ts
const response = await fetch(`${apiBaseUrl}/projects/${projectId}/tasks`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ title: 'Giriş ekranını hazırla' }),
});
if (!response.ok) throw new Error(`Görev oluşturulamadı: ${response.status}`);
const createdTask = await response.json();
// Görev listesini yeniden yükle; createdTask.id detay ekranında kullanılır.
```

`fetch` ağ hatasında da reddedilebilir; sayfa bu hatayı yakalayıp formu korumalıdır. Formun diğer alanları için handoff dosyasındaki `CreateTaskDto` tablosunu kullan. `createdById` gönderme; backend oturumdan belirler.

### Düzenleme: durum seçimi veya görev formu

```ts
const response = await fetch(`${apiBaseUrl}/tasks/${task.id}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    status: 'DONE',
    expectedUpdatedAt: task.updatedAt,
  }),
});
if (response.status === 409) {
  // Güncel görevi getir, taslağı koru ve kullanıcıya farkı göster.
  // Yeni sürümle otomatik olarak üzerine yazma.
  throw new Error('Görev başka bir işlemle değişti. Yeniden incele.');
}
if (!response.ok) throw new Error(`Görev güncellenemedi: ${response.status}`);
const updatedTask = await response.json();
// Detayı updatedTask ile güncelle, ilgili listeyi yeniden yükle.
```

`expectedUpdatedAt` için son okuduğun `updatedAt` değerini aynen kullan. Bugünün tarihini veya ekranda biçimlendirilmiş tarihi gönderme. Başarılı yanıtın yeni sürümünü sonraki düzenlemede kullan.

### Silme: onay penceresindeki Sil düğmesi

```ts
const query = new URLSearchParams({ expectedUpdatedAt: task.updatedAt });
const response = await fetch(`${apiBaseUrl}/tasks/${task.id}?${query}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (!response.ok) throw new Error(`Görev silinemedi: ${response.status}`);
// Başarı 204: response.json() çağırma.
// Detay ekranından çık, görev listesini yeniden yükle.
```

Görev silinince yorumları da silinir. Alan/proje/görev/yorum düzenleme ve silmede sürüm gerekir; **profil ve üyelik işlemleri bunun dışındadır**. Silme hata durumlarını ortak istemcide ele al; 409'da kullanıcı güncel kaydı incelemeden silmeyi tekrarlama.

## 7. Formlarda ve listelerde dikkat edeceğin ayrımlar

| Konu                         | Doğru kullanım                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Atanan kişi                  | `members[].userId` gönder; `members[].id` üyelik kimliğidir                                                 |
| Üye çıkarma / rol değiştirme | URL'de `members[].id` kullan                                                                                |
| Atamayı kaldırma             | `/tasks/:id/assign` PATCH gövdesinde `assigneeId: null` ve `expectedUpdatedAt`                              |
| Durum                        | API'ye `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` gönder; ekranda Türkçe etiket gösterebilirsin             |
| Öncelik                      | `LOW`, `MEDIUM`, `HIGH`, `URGENT`                                                                           |
| Liste yanıtı                 | Proje/görev/yorum: `{ data, meta }`; alan/üye: doğrudan dizi                                                |
| Sayfalama                    | `page` başlangıcı 1, varsayılan `limit` 20, en fazla 100; filtre değişince sayfayı 1'e al                   |
| Görev arama                  | Görev listesine `search` sorgusu; ayrıca `status`, `priority`, `assigneeId`, `sortBy`, `sortOrder`          |
| Son tarih                    | Saat dilimi içeren ISO metni gönder; gösterirken yerel saate çevir. Yeni görevde geçmiş tarih kabul edilmez |
| Form gövdesi                 | Yalnız izin verilen alanları gönder; yanıt nesnesinin tamamını PATCH'e kopyalama                            |
| Alan sahipliği               | OWNER otomatik atanır; üyelik formunda seçilebilir roller ADMIN ve MEMBER, ayrıca rol kısıtları uygulanır   |

## 8. Yetki ve ekran geri bildirimi

OWNER/ADMIN proje yönetebilir; MEMBER görev oluşturabilir, düzenleyebilir ve atayabilir. MEMBER yalnız kendi oluşturduğu görevi silebilir. Yorumu yalnız yazarı düzenleyebilir; yazarı veya OWNER/ADMIN silebilir. Alanı yalnız OWNER silebilir. ADMIN yalnız MEMBER üyeleri yönetebilir; OWNER rolü değiştirilemez. Tam matris handoff dosyasındadır.

Her veri ekranında yükleniyor, boş liste ve hata durumunu tasarla. Her formda gönderim sürerken tekrar göndermeyi engelle. Başarı mesajını ancak başarılı HTTP yanıtından sonra göster.

- **400:** Girdileri ve hata mesajlarını kontrol et; formu boşaltma.
- **401:** Korumalı isteklerde oturum yenileme akışı; yanlış giriş şifresinde yenileme yapma.
- **403:** Erişim yok; düğmeleri ve mevcut alan üyeliğini yeniden değerlendir.
- **404:** Kaynak/kullanıcı bulunamadı. Bazı kapsamlı rotalar erişim koruması nedeniyle 403 döner.
- **409:** Oluşturmada yinelenen kayıt; düzenleme/silmede eski sürüm olabilir. İşlem bağlamına göre göster.
- **429:** Çok sık istek; tekrarları yavaşlat.
- **500 veya bağlantı hatası:** İşlemi başarılı gösterme, kullanıcının girdisini koru.

Backend hata gövdesindeki `message` metin veya dizi olabilir. Liste aramasında eski isteğin geç gelen yanıtını yeni filtre sonucunun üzerine yazma. Başarılı değişiklikten sonra ilgili detay ve listeyi yenile. Sekmeye geri dönünce yeniden veri çek; sunucunun önbellek başlığı frontend belleğini kendiliğinden temizlemez.

## 9. Hangi sırayla geliştirmelisin?

1. API'yi çalıştır, Swagger'dan hesap oluşturup giriş yapmayı dene.
2. Frontend yapılandırmasını, API istemcisini ve yanıt tiplerini oluştur.
3. Kayıt, giriş, kullanıcı profili, yenileme ve çıkış akışını bağla.
4. Alan listesi, alan oluşturma ve seçili alan durumunu kur.
5. Üye listesini yükle; rol görünürlüğünü ve üyelik işlemlerini ekle.
6. Proje listesi, oluşturma ve proje detayını bağla.
7. Görev listesi, oluşturma, detay, düzenleme, atama ve silmeyi ekle.
8. Arama/filtre/sayfalama ile yorumları tamamla.
9. İki istemcide aynı kaydı düzenleyerek 409 akışını, üye olmayan hesapla 403'ü, ağ kesilince hata geri bildirimini dene. Ayrı deneme hesapları/alanları kullan.

Önce şu yolun baştan sona çalışmasını hedefle: **Giriş → alan seçimi → proje seçimi → görev oluşturma → görev durumunu değiştirme → yorum ekleme.** Sonra kalan yönetim ekranlarını tamamla.

Pano istersen dört görev durumuna göre sütun oluşturabilirsin; sürükle-bırak durum PATCH çağrısı yapar. Kalıcı sütun içi sıra, sprint, backlog, etiket ve bildirim API'leri mevcut değil. Bunları hazırmış gibi arayüze bağlama; yeni ihtiyaç olursa backend geliştirmesi olarak ayrıca konuşalım.

## 10. Elindeki belgeleri nasıl kullanacaksın?

- **Bu dosya:** Projeyi kurarken ve frontend dosyalarının sorumluluklarını ayırırken.
- **[FRONTEND_HANDOFF.md](./FRONTEND_HANDOFF.md):** Bir formun alanlarını, endpoint'in yanıtını, rolü veya hata davranışını yazarken.
- **[README.md](./README.md):** Backend kurulumunda, ayarlarda ve test komutlarında.
- **Yerel Swagger (`http://localhost:3000/api/docs`):** Gerçek istek gönderip yanıtı görürken. Bazı yanıt modelleri Swagger'da ayrıntılı değildir; handoff dosyasına da bak.

Bu belge bir uygulama planıdır. Burada önerilen frontend klasörleri ve kod parçaları çalışan bir frontend projesi olarak oluşturulmamıştır.
