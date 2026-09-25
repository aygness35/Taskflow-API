# TaskFlow — Frontend entegrasyon rehberi

Bu belge mevcut backend kaynak koduna dayanır. Görsel tasarım değil, ekranların API ile nasıl çalışacağını açıklar. Ekranlar işlevsel gruplardır; sayfa, sekme veya diyalog olarak uygulanabilir. Backend davranışı ve normal README değiştirilmemiştir.

## 1. Kapsam ve kaynaklar

Backend; çalışma alanları içinde proje, görev, atama ve yorum yönetir. Roller çalışma alanına özeldir; aynı kullanıcı farklı alanlarda farklı rollere sahip olabilir.

| Konu                         | İncelenen kaynaklar                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Uygulama, port, yapılandırma | `src/main.ts`, `src/app.module.ts`, `src/setup.ts`, `src/config/environment.ts`                                      |
| Kimlik doğrulama             | `src/auth/`: modül, controller, servis, DTO ve JWT guard                                                             |
| Profil                       | `src/users/`: modül, controller, servis, DTO ve `user.entity.ts`                                                     |
| Alan, proje, görev, yorum    | `src/workspaces/`, `src/projects/`, `src/tasks/`, `src/comments/`: tüm modül, controller, servis ve DTO'lar          |
| Yetki ve hata                | `src/common/access.service.ts`, `workspace-access.guard.ts`, `decorators.ts`, `enums.ts`, `http-exception.filter.ts` |
| Sürüm, tarih, sayfalama      | `src/common/version.ts`, `version.dto.ts`, `date-time.validator.ts`, `pagination.dto.ts`                             |
| Veri ve testler              | `src/prisma/`, `prisma/schema.prisma`, migration, `test/app.e2e-spec.ts`, `src/**/*.spec.ts`                         |

Kaynak kökü `Login` deposudur. İnceleme sırasında içindeki `Taskflow_Api/` klasöründe yalnız `.git` ve `.gitattributes` vardı; uygulama kaynakları o klasörde değildi. Arkadaşınıza gerçek kaynak kökünü gönderin.

## 2. Bağlantı ve genel sözleşme

- Varsayılan API adresi `http://localhost:3000`; port `PORT` ayarından gelir.
- Global `/api` ön eki yoktur. Doğru giriş yolu `/auth/login` olur.
- Swagger `/api/docs`, OpenAPI `/api/docs-json` adresindedir; bunlar aşağıdaki 31 işlevsel işlem sayısına dahil değildir.
- Gövdeli istekler `Content-Type: application/json` kullanır.
- Korumalı istek: `Authorization: Bearer <accessToken>`. Token cookie veya query'den okunmaz.
- CORS adresi `CORS_ORIGINS` ile belirlenir. Örnek ayar `http://localhost:3001`'dir. Başka adres kullanılırsa backend ayarı güncellenir. `credentials: false`; hazır cookie oturumu yoktur.
- DTO'lu isteklerde tanımsız alanlar reddedilir. Dönen nesnenin tamamını PATCH'e kopyalamayın.
- Kaynak ve üyelik rota kimlikleri UUID v4 olmalıdır. Yanlış biçim 400 döndürür.
- Guard'lar DTO doğrulamasından önce çalışabildiğinden hatalı gövdeye rağmen önce 401/403 alınabilir.
- Tek nesne yanıtlarında `success`/`result` sarmalayıcısı yoktur. 204 yanıtının gövdesi yoktur; JSON olarak çözümlemeyin.
- `Cache-Control: no-store` vardır. Frontend belleğindeki veri kendiliğinden yenilenmez.

## 3. Yanıtlar ve veri modeli

Tarihler JSON'da UTC zaman damgası metni olarak döner. Aşağıdaki şekiller servislerin Prisma sorgularından doğrulanmıştır.

| Yanıt          | Alanlar                                                                                                                           | İlişki ve önemli ayrım                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| TokenPair      | `accessToken`, `refreshToken`                                                                                                     | İkisi string; profil veya ayrı expiresIn yok                                  |
| User           | `id`, `email`, `name`, `createdAt`, `updatedAt`                                                                                   | Rol/parola/hash yok                                                           |
| Workspace      | `id`, `name`, `ownerId`, `createdAt`, `updatedAt`                                                                                 | ownerId kullanıcı kimliği; ilişkiler/sayaçlar dahil değil                     |
| Member         | `id`, `workspaceId`, `userId`, `role`, `joinedAt`                                                                                 | id üyelik kimliği; userId kullanıcı kimliği                                   |
| MemberWithUser | Member alanları ve `user: User`                                                                                                   | Üye listeleme ve ekleme yanıtı                                                |
| Project        | `id`, `workspaceId`, `name`, `description`, `status`, `createdAt`, `updatedAt`                                                    | description string/null; görevler dahil değil                                 |
| Task           | `id`, `projectId`, `title`, `description`, `status`, `priority`, `dueDate`, `assigneeId`, `createdById`, `createdAt`, `updatedAt` | description, dueDate, assigneeId null olabilir; kullanıcı/yorum nesneleri yok |
| Comment        | `id`, `taskId`, `authorId`, `content`, `createdAt`, `updatedAt`                                                                   | Yazarın adı/e-postası dahil değil                                             |
| Page<T>        | `data: T[]`, `meta: { total, page, limit, totalPages }`                                                                           | Metadata alanları sayıdır                                                     |

Workspace → Project → Task → Comment ilişkisi bulunur. WorkspaceMember kullanıcıyı alana bağlar. RefreshToken sunucu içi modeldir; `tokenHash`, `revoked`, `expiresAt` veritabanı alanları frontend'e gönderilmez.

Sunucu `id`, `createdAt`, `updatedAt`, `joinedAt`, `ownerId`, `createdById`, `authorId` alanlarını belirler. Bunları gövdeye koymayın. İlgili `workspaceId`, `projectId`, `taskId` rota üzerinden belirlenir. `expectedUpdatedAt` bir istek önkoşuludur, kayıt alanı değildir.

Atamada `members[].userId`, üyelik düzenleme/silmede `members[].id` kullanılır. Yorum yazarını ve görev oluşturanı üye listesinden eşleştirebilirsiniz. Kişi alandan ayrılmışsa içerik kalır ama güncel üyelerde kişi bulunmayabilir. Genel kullanıcı detay/arama API'si yoktur; eksik yazar adı için güvenli bir gösterim gerekir.

| Enum          | Değerler                                   | Varsayılan                                       |
| ------------- | ------------------------------------------ | ------------------------------------------------ |
| Role          | `OWNER`, `ADMIN`, `MEMBER`                 | Alanı oluşturan OWNER; üye eklemede role zorunlu |
| ProjectStatus | `ACTIVE`, `ARCHIVED`                       | ACTIVE                                           |
| TaskStatus    | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` | TODO                                             |
| Priority      | `LOW`, `MEDIUM`, `HIGH`, `URGENT`          | MEDIUM                                           |

Görev durumları arasında tüm geçişler serbesttir; DONE yeniden açılabilir. ARCHIVED proje üzerinde görev oluşturma/düzenlemeyi engelleyen kontrol yoktur. Arşivleme bir salt okunur kilit değildir.

## 4. Oturum akışı

1. Kayıtta name/email/password → POST /auth/register → 201 TokenPair.
2. Girişte email/password → POST /auth/login → 200 TokenPair.
3. Access token ile GET /auth/me veya GET /users/me → User.
4. GET /workspaces → kullanıcının üyesi olduğu alanlar. Kayıt otomatik alan/proje oluşturmaz.
5. Alan seçilince üyeler yüklenir; `member.userId === currentUser.id` kaydı kullanıcının o alandaki rolünü verir. Profil ve JWT rol içermez.

Access JWT; `sub`, `type: 'access'`, `iss: 'taskflow'`, `aud: 'taskflow-api'` ve zaman iddiaları taşır. HS256, 15 dakika. Refresh JWT ayrı anahtar, `type: 'refresh'`, `aud: 'taskflow-refresh'`, benzersiz `jti` ve 7 günlük süre kullanır. Frontend JWT üretmez/değiştirmez.

### Yenileme ve 401

POST /auth/refresh gövdesi `{ "refreshToken": "..." }`; access token gerekmez. Başarılı 200 yanıtta **iki tokenı birlikte değiştirin**. Eski refresh token tekrar kullanılamaz. Eşzamanlı iki refresh isteğinden yalnız biri başarılı olur.

Frontend uygulama önerisi: korumalı istekte 401 sonrası tek ortak refresh isteği kullanın; başarılıysa orijinal isteği en fazla bir kez tekrar edin. Refresh de 401 ise yerel oturumu temizleyip giriş isteyin. Login'in yanlış parola 401'ini yenilemeye sokmayın. Ağ/500 hatası tek başına oturumun geçersiz olduğunu göstermez. 403 için refresh yapılmaz; kaynak erişimi yeniden değerlendirilir. Token saklama yeri backend tarafından belirlenmez.

### Çıkış

POST /auth/logout, RefreshDto alır. Access token gerekmez; refresh JWT'nin imzası/türü/süresi doğrulanır. Başarı 204'tür. İptal edilmiş ama süresi dolmamış tokenla tekrar logout hata gerektirmez. Başarı sonrası yerel token ve kullanıcı verilerini temizleyin. Ağ hatasında sunucudaki iptal doğrulanmış değildir. Eski access token süresi dolana kadar çalışabilir; diğer oturumlar iptal edilmez.

## 5. Form ve DTO sözleşmeleri

Sayılmayan alanları göndermeyin. Alanı atlamak ve null göndermek farklıdır. Tarih doğrulaması bölüm sonunda açıklanmıştır.

### Kayıt — RegisterDto

| Alan     | Tür    | Zorunlu | Doğrulama                                                         | Not                                       |
| -------- | ------ | ------- | ----------------------------------------------------------------- | ----------------------------------------- |
| name     | string | Evet    | Kırpılmış 2–50 karakter                                           | Kullanıcı adı                             |
| email    | string | Evet    | E-posta, en fazla 254 karakter                                    | Kırpılır/küçük harfe çevrilir; benzersiz  |
| password | string | Evet    | 8–72 karakter, en az bir `[A-Z]` ve rakam; en fazla 72 UTF-8 bayt | Kırpılmaz; çok baytlı karakterlere dikkat |

### Giriş — LoginDto

| Alan     | Tür    | Zorunlu | Doğrulama                                              | Not                                                   |
| -------- | ------ | ------- | ------------------------------------------------------ | ----------------------------------------------------- |
| email    | string | Evet    | E-posta, en fazla 254                                  | Kırpılır/küçük harfe çevrilir                         |
| password | string | Evet    | 8–72 karakter; 72 UTF-8 bayttan uzunsa servis reddeder | Kayıttaki büyük harf/rakam kuralı login DTO'sunda yok |

### Yenileme ve çıkış — RefreshDto

| Alan         | Tür    | Zorunlu | Doğrulama                            | Not                  |
| ------------ | ------ | ------- | ------------------------------------ | -------------------- |
| refreshToken | string | Evet    | 1–2048 karakter, servis JWT kontrolü | Güncel refresh token |

### Profil — UpdateUserDto

| Alan | Tür    | Zorunlu | Doğrulama                  | Not                               |
| ---- | ------ | ------- | -------------------------- | --------------------------------- |
| name | string | Hayır   | Kırpılmış 2–50; null değil | Yalnız ad değişir; sürüm gerekmez |

### Alan oluşturma/düzenleme — CreateWorkspaceDto / UpdateWorkspaceDto

| Alan              | Tür    | Oluşturma / düzenleme  | Doğrulama                   | Not                      |
| ----------------- | ------ | ---------------------- | --------------------------- | ------------------------ |
| name              | string | Zorunlu / isteğe bağlı | Kırpılmış 2–100; null değil | ownerId gönderilmez      |
| expectedUpdatedAt | string | Gönderilmez / zorunlu  | Tarih sözleşmesi            | Alanın son okunan sürümü |

### Üye ekleme/rol değiştirme — AddMemberDto / MemberRoleDto

| Alan  | Tür    | Zorunlu                                     | Doğrulama                                            | Not                                                         |
| ----- | ------ | ------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| email | string | Eklemede evet; rol değiştirmede gönderilmez | E-posta, en fazla 254; kırpılır/küçük harfe çevrilir | Kullanıcı zaten kayıtlı olmalı; davet e-postası gönderilmez |
| role  | enum   | Her ikisinde evet                           | ADMIN veya MEMBER                                    | OWNER atanamaz; ADMIN yalnız MEMBER ekler                   |

Üyelik mutasyonlarında expectedUpdatedAt yoktur. Üye silmede gövde gerekmez.

### Proje oluşturma/düzenleme — CreateProjectDto / UpdateProjectDto

| Alan              | Tür         | Oluşturma / düzenleme       | Doğrulama                        | Not                      |
| ----------------- | ----------- | --------------------------- | -------------------------------- | ------------------------ |
| name              | string      | Zorunlu / isteğe bağlı      | Kırpılmış 2–100; null değil      | Alan adıyla aynı kural   |
| description       | string/null | İsteğe bağlı / isteğe bağlı | En fazla 2000                    | null temizler; kırpılmaz |
| status            | enum        | İsteğe bağlı / isteğe bağlı | ACTIVE veya ARCHIVED; null değil | Varsayılan ACTIVE        |
| expectedUpdatedAt | string      | Gönderilmez / zorunlu       | Tarih sözleşmesi                 | Proje sürümü             |

### Görev oluşturma/düzenleme — CreateTaskDto / UpdateTaskDto

| Alan              | Tür         | Oluşturma / düzenleme       | Doğrulama                            | Not                                                         |
| ----------------- | ----------- | --------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| title             | string      | Zorunlu / isteğe bağlı      | Kırpılmış 3–150; null değil          | Başlık                                                      |
| description       | string/null | İsteğe bağlı / isteğe bağlı | En fazla 2000                        | null temizler; kırpılmaz                                    |
| status            | enum        | İsteğe bağlı / isteğe bağlı | TaskStatus; null değil               | Varsayılan TODO                                             |
| priority          | enum        | İsteğe bağlı / isteğe bağlı | Priority; null değil                 | Varsayılan MEDIUM                                           |
| dueDate           | tarih/null  | İsteğe bağlı / isteğe bağlı | Tarih sözleşmesi                     | Oluşturmada geçmiş tarih yasak; güncellemede bu kontrol yok |
| assigneeId        | UUID/null   | İsteğe bağlı / isteğe bağlı | UUID v4, mevcut alan üyesi kullanıcı | null atamayı kaldırır; üyelik ID'si değil                   |
| expectedUpdatedAt | string      | Gönderilmez / zorunlu       | Tarih sözleşmesi                     | Görev sürümü                                                |

projectId güncellenemez; görev taşıma işlemi yoktur.

### Atama — AssignTaskDto

| Alan              | Tür       | Zorunlu | Doğrulama               | Not                                |
| ----------------- | --------- | ------- | ----------------------- | ---------------------------------- |
| assigneeId        | UUID/null | Evet    | UUID v4 ve alan üyeliği | Atlamak 400; null atamayı kaldırır |
| expectedUpdatedAt | string    | Evet    | Tarih sözleşmesi        | Görevin sürümü                     |

### Yorum oluşturma/düzenleme — CreateCommentDto / UpdateCommentDto

| Alan              | Tür    | Oluşturma / düzenleme  | Doğrulama                    | Not                  |
| ----------------- | ------ | ---------------------- | ---------------------------- | -------------------- |
| content           | string | Zorunlu / isteğe bağlı | Kırpılmış 1–2000; null değil | authorId gönderilmez |
| expectedUpdatedAt | string | Gönderilmez / zorunlu  | Tarih sözleşmesi             | Yorum sürümü         |

PATCH'te iş alanları isteğe bağlıdır; yalnız sürüm içeren PATCH yasaklanmamıştır. Frontend değişiklik yoksa göndermemeyi tercih edebilir.

### Tarih ve silme — VersionDto

dueDate ve expectedUpdatedAt: `YYYY-MM-DDTHH:mm:ss`, isteğe bağlı 1–3 kesir basamağı, ardından `Z` veya `±HH:mm`. Geçerli takvim tarihi gerekir. Örnek `2099-01-01T12:00:00+03:00`. Yalnız tarih, hafta tarihi, saat dilimsiz saat ve üçten fazla kesir basamağı reddedilir.

| Silme sorgusu     | Tür    | Zorunlu | Doğrulama                               | Kapsam                                             |
| ----------------- | ------ | ------- | --------------------------------------- | -------------------------------------------------- |
| expectedUpdatedAt | string | Evet    | Tarih biçimi ve kayıt sürümüyle eşleşme | Alan/proje/görev/yorum DELETE; üyelik DELETE hariç |

## 6. API envanteri — 31 işlem

JWT: access token gerekir. Açık: access token gerekmez; refresh/logout yine refresh JWT doğrular. Üye: ilgili alanın güncel üyesi. V: zorunlu expectedUpdatedAt **query** parametresi. DTO'lar bölüm 5'te açıklanmıştır.

Ortak hatalar: JWT rotalarında 401; alan kapsamlı kaynakta erişim yoksa veya kaynak bilinmiyorsa 403; hatalı UUID/DTO için 400; istek sınırında 429; beklenmeyen sunucu hatasında 500. Son sütun ek koşulları belirtir. İşlem sırasında silinen kaynak ayrıca 404 veya sürümlü mutasyonda 409 oluşturabilir.

| Ekran/işlev           | Metot  | Yol                                 | Yetki                 | Gövde / query      | Başarı               | Ek hata / kural                                         |
| --------------------- | ------ | ----------------------------------- | --------------------- | ------------------ | -------------------- | ------------------------------------------------------- |
| Kayıt                 | POST   | `/auth/register`                    | Açık                  | RegisterDto        | 201 TokenPair        | E-posta tekrarı 409; bayt sınırı 400                    |
| Giriş                 | POST   | `/auth/login`                       | Açık                  | LoginDto           | 200 TokenPair        | Yanlış bilgiler 401                                     |
| Yenile                | POST   | `/auth/refresh`                     | Açık                  | RefreshDto         | 200 TokenPair        | Eski/iptal/süresi dolmuş token 401                      |
| Çıkış                 | POST   | `/auth/logout`                      | Açık                  | RefreshDto         | 204 boş              | Geçersiz/süresi dolmuş token 401                        |
| Oturum profili        | GET    | `/auth/me`                          | JWT                   | —                  | 200 User             | Kullanıcı yoksa 404                                     |
| Profil                | GET    | `/users/me`                         | JWT                   | —                  | 200 User             | Kullanıcı yoksa 404                                     |
| Profil adı            | PATCH  | `/users/me`                         | JWT                   | UpdateUserDto      | 200 User             | Sürümsüz; yalnız name                                   |
| Alan oluştur          | POST   | `/workspaces`                       | JWT                   | CreateWorkspaceDto | 201 Workspace        | Otomatik OWNER üyeliği                                  |
| Alanlar               | GET    | `/workspaces`                       | JWT                   | —                  | 200 Workspace[]      | Yalnız üye olunanlar                                    |
| Alan detayı           | GET    | `/workspaces/:id`                   | Üye                   | —                  | 200 Workspace        | İlişkiler dahil değil                                   |
| Alan düzenle          | PATCH  | `/workspaces/:id`                   | OWNER/ADMIN           | UpdateWorkspaceDto | 200 Workspace        | Eski sürüm 409                                          |
| Alan sil              | DELETE | `/workspaces/:id`                   | OWNER                 | V                  | 204 boş              | Eski sürüm 409; alt kayıtlar silinir                    |
| Üyeler                | GET    | `/workspaces/:id/members`           | Üye                   | —                  | 200 MemberWithUser[] | Sayfalama yok                                           |
| Üye ekle              | POST   | `/workspaces/:id/members`           | OWNER/ADMIN           | AddMemberDto       | 201 MemberWithUser   | Hesap yok 404; tekrar üyelik 409; rol kısıtı 403        |
| Rol değiştir          | PATCH  | `/workspaces/:id/members/:memberId` | OWNER/ADMIN           | MemberRoleDto      | 200 Member           | OWNER değişmez; ADMIN yönetici yönetemez; hedef yok 404 |
| Üye çıkar/ayrıl       | DELETE | `/workspaces/:id/members/:memberId` | Bölüm 7               | —                  | 204 boş              | OWNER çıkarılamaz; hedef yok 404; atamalar temizlenir   |
| Proje oluştur         | POST   | `/workspaces/:workspaceId/projects` | OWNER/ADMIN           | CreateProjectDto   | 201 Project          | Alan rotadan                                            |
| Projeler              | GET    | `/workspaces/:workspaceId/projects` | Üye                   | ListProjectsDto    | 200 Page<Project>    | Bölüm 8                                                 |
| Proje detayı          | GET    | `/projects/:id`                     | Üye                   | —                  | 200 Project          | Görevler dahil değil                                    |
| Proje düzenle/arşivle | PATCH  | `/projects/:id`                     | OWNER/ADMIN           | UpdateProjectDto   | 200 Project          | Eski sürüm 409                                          |
| Proje sil             | DELETE | `/projects/:id`                     | OWNER/ADMIN           | V                  | 204 boş              | Eski sürüm 409; görev/yorumlar silinir                  |
| Görev oluştur         | POST   | `/projects/:projectId/tasks`        | Üye                   | CreateTaskDto      | 201 Task             | Geçmiş tarih/atanan üye değil 400                       |
| Görevler              | GET    | `/projects/:projectId/tasks`        | Üye                   | ListTasksDto       | 200 Page<Task>       | Bölüm 8                                                 |
| Görev detayı          | GET    | `/tasks/:id`                        | Üye                   | —                  | 200 Task             | Yorumlar dahil değil                                    |
| Görev düzenle         | PATCH  | `/tasks/:id`                        | Üye                   | UpdateTaskDto      | 200 Task             | Atama geçersiz 400; eski sürüm 409                      |
| Atama                 | PATCH  | `/tasks/:id/assign`                 | Üye                   | AssignTaskDto      | 200 Task             | Atama geçersiz 400; eski sürüm 409                      |
| Görev sil             | DELETE | `/tasks/:id`                        | Oluşturan/OWNER/ADMIN | V                  | 204 boş              | Diğer MEMBER 403; eski sürüm 409; yorumlar silinir      |
| Yorum ekle            | POST   | `/tasks/:taskId/comments`           | Üye                   | CreateCommentDto   | 201 Comment          | Yazar JWT'den                                           |
| Yorumlar              | GET    | `/tasks/:taskId/comments`           | Üye                   | PaginationDto      | 200 Page<Comment>    | Bölüm 8                                                 |
| Yorum düzenle         | PATCH  | `/comments/:id`                     | Yazar ve üye          | UpdateCommentDto   | 200 Comment          | Başka yazar 403; eski sürüm 409                         |
| Yorum sil             | DELETE | `/comments/:id`                     | Yazar/OWNER/ADMIN     | V                  | 204 boş              | Diğer MEMBER 403; eski sürüm 409                        |

:id ilgili satırın kaynak kimliğidir. :workspaceId, :projectId ve :taskId üst kaynak kimlikleridir. :memberId WorkspaceMember kimliğidir. Hepsi UUID v4.

## 7. Yetki matrisi

Rol çalışma alanına özeldir; JWT'de genel bir yönetici rolü varmış gibi davranmayın. Geçerli rolü üye listesindeki `userId` ile oturum kullanıcısını eşleştirerek bulun. Arayüzde düğme gizlemek sunucu yetkilendirmesinin yerine geçmez.

| İşlem                                     | OWNER                  | ADMIN                              | MEMBER           |
| ----------------------------------------- | ---------------------- | ---------------------------------- | ---------------- |
| Alanı/projeleri/görevleri/yorumları görme | Evet                   | Evet                               | Evet             |
| Alanı düzenleme                           | Evet                   | Evet                               | Hayır            |
| Alanı silme                               | Evet                   | Hayır                              | Hayır            |
| Proje oluşturma/düzenleme/silme           | Evet                   | Evet                               | Hayır            |
| Üye ekleme                                | ADMIN veya MEMBER      | Yalnız MEMBER                      | Hayır            |
| Üye rolünü değiştirme                     | OWNER dışındaki üyeler | ADMIN yönetemez veya ADMIN yapamaz | Hayır            |
| Başkasını çıkarma                         | OWNER dışındaki üyeler | Yalnız MEMBER                      | Hayır            |
| Kendisi ayrılma                           | Hayır                  | Evet                               | Evet             |
| Görev oluşturma/düzenleme/atama           | Evet                   | Evet                               | Evet             |
| Görev silme                               | Evet                   | Evet                               | Yalnız oluşturan |
| Yorum oluşturma                           | Evet                   | Evet                               | Evet             |
| Yorum düzenleme                           | Yalnız yazar           | Yalnız yazar                       | Yalnız yazar     |
| Yorum silme                               | Evet                   | Evet                               | Yalnız yazar     |

OWNER rolü değiştirilemez, alan sahibi çıkarılamaz ve sahiplik devri endpoint'i yoktur. Alan üyeliği kaldırılan kişi, kendi oluşturduğu göreve veya yoruma da erişemez. Üyelik silme çağrısına kullanıcı kimliği değil `WorkspaceMember.id` gönderilir. Kaynak bulunamadığında alan erişim koruması çoğu kapsamlı rotada `403` döndürür; her eksik kaynağı `404` beklemeyin.

## 8. Listeleme, arama ve sayfalama

| Liste                               | Parametreler                                                                         | Varsayılan sıralama        |
| ----------------------------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| `/workspaces`                       | Tanımlı filtre/sayfalama yok                                                         | `createdAt desc`, `id asc` |
| `/workspaces/:id/members`           | Tanımlı filtre/sayfalama yok                                                         | `joinedAt asc`, `id asc`   |
| `/workspaces/:workspaceId/projects` | `page`, `limit`, `status`                                                            | `createdAt desc`, `id asc` |
| `/projects/:projectId/tasks`        | `page`, `limit`, `status`, `priority`, `assigneeId`, `search`, `sortBy`, `sortOrder` | `createdAt desc`, `id asc` |
| `/tasks/:taskId/comments`           | `page`, `limit`                                                                      | `createdAt asc`, `id asc`  |

`page`: tam sayı, 1–1.000.000, varsayılan 1. `limit`: tam sayı, 1–100, varsayılan 20. Görev `sortBy`: `createdAt`, `updatedAt`, `dueDate`, `title`; `sortOrder`: `asc` veya `desc`. Eşitlikler `id asc` ile çözülür. `status` ve `priority` bölüm 3'teki enum değerleridir; `assigneeId` UUID v4'tür. `search` en fazla 150 karakterdir, kırpılmaz ve başlık **veya** açıklamada `contains` araması yapar. Farklı filtreler birlikte AND koşuluyla uygulanır. Türkçe büyük/küçük harf eşdeğerliği garanti edilmez.

Örnek: `GET /projects/{projectId}/tasks?page=1&limit=20&status=TODO&sortBy=updatedAt&sortOrder=desc`. Sorguyu `URLSearchParams` ile kodlayın.

```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 }
}
```

Filtre değişince sayfayı 1'e alın. Son satırı silince geçerli son sayfayı tekrar yükleyin. `assigneeId=null` veya boş değer ile atanmamış görev filtresi desteklenmez. Tarih aralığı, etiket, görev tipi ve alanlar arası görev araması yoktur. DTO kullanan listelerde bilinmeyen sorgu alanları `400` üretir; alan ve üye listelerinde sorgu DTO'su olmadığından fazladan parametreler filtreleme sağlamaz.

Liste ve toplam sayısı aynı veritabanı transaction'ında okunur. Ayrı sayfa istekleri ortak bir veri anına sabitlenmez; eşzamanlı ekleme/silmede offset kayması olabilir. Toplamlar sadece ilgili filtre kapsamındadır. Tüm görevlerin durum sayaçlarını tek sayfadaki görevlerden hesaplamayın; özel sayaç endpoint'i yoktur.

## 9. Frontend ekranlarının işlevsel haritası

Aşağıdaki ekranlar entegrasyon önerisidir; backend bunlar için görsel tasarım veya URL yapısı dayatmaz. Bütün formlar bölüm 5'teki alan sınırlarını uygular. Her ilk yüklemede yükleniyor, boş sonuç, başarısız yükleme ve yeniden deneme durumları bulunmalıdır. Gönderim sürerken aynı işlemi tekrar başlatmayın; hata halinde kullanıcının girdisini koruyun.

| Ekran ve amaç              | İlk yükleme / gösterilecek veri                                                                 | Formlar ve işlemler                                                                            | Özel durumlar                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kayıt: hesap açma          | API yüklemesi gerekmez                                                                          | `name`, `email`, `password` → `POST /auth/register`; TokenPair sonrası profil yükle            | Alan hataları 400; mevcut e-posta 409; sınır 429; başarıda alan seçimine geç                                                                            |
| Giriş: oturum açma         | Geçerli oturum varsa `/auth/me`                                                                 | `email`, `password` → `POST /auth/login`                                                       | Yanlış bilgiler 401; 429; bağlantı hatasında giriş olmuş gibi yönlendirme yapma                                                                         |
| Profil ve oturum           | `GET /users/me`: ad, e-posta, tarihler                                                          | Ad → `PATCH /users/me`; çıkış → `POST /auth/logout`                                            | E-posta/parola düzenleme sunulmaz; boş ad 400; çıkış ağ hatasının sunucudaki iptali doğrulamadığını belirt                                              |
| Alan seçimi ve oluşturma   | `GET /workspaces`: ad, kimlik, tarihler                                                         | Ad → `POST /workspaces`; seçimle alan detayına geç                                             | Boş liste ilk alanı oluşturma çağrısı; oluşturma sonrası listeyi yenile                                                                                 |
| Alan detayı ve ayarlar     | `GET /workspaces/:id` + üyeler: ad, sahip, mevcut rol                                           | Ad ve sürüm → PATCH; OWNER için sürümlü DELETE                                                 | Üye olmama 403; eski sürüm 409; silmede alt projeler/görevler/yorumlar kaybolacağını açıkla                                                             |
| Üye yönetimi               | `GET /workspaces/:id/members`: kullanıcı adı/e-posta, rol, üyelik kimliği                       | E-posta ve rol → POST; rol → PATCH; üyelik kimliği → DELETE                                    | Kayıtlı olmayan kullanıcı 404; mevcut üyelik 409; yetki 403; OWNER satırını değiştirilebilir gösterme                                                   |
| Proje listesi ve oluşturma | `GET /workspaces/:workspaceId/projects`: ad, açıklama, durum, tarihler, meta; yetki için üyeler | Durum filtresi/sayfalama; ad, açıklama, durum → POST                                           | Hiç proje yok ile filtre sonucu boş durumlarını ayır; MEMBER için oluşturma kapalı                                                                      |
| Proje detayı ve ayarlar    | `GET /projects/:id`: proje ve workspaceId; üyeler                                               | Alanlar ve sürüm → PATCH; sürümlü DELETE                                                       | ARCHIVED salt okunur değildir; 409'da sunucu sürümünü getir; silme görev ve yorumları da siler                                                          |
| Görev listesi ve oluşturma | Proje, üye listesi ve `GET /projects/:projectId/tasks`: alanlar + meta                          | Arama/filtre/sıralama; başlık, açıklama, durum, öncelik, son tarih, atanan kişi → POST         | Atanan kişi seçimi üyelerin `userId` değerlerini kullanır; geçmiş oluşturma tarihi 400; başarısız istek eski filtre sonucunu yeniymiş gibi göstermemeli |
| Görev detayı ve yorumlar   | `GET /tasks/:id`; proje üzerinden alan/üyeler; `GET /tasks/:taskId/comments`                    | Görev alanları + sürüm → PATCH; atama + sürüm → `/assign`; silme; yorum ekleme/düzenleme/silme | 409 çatışması, 403 erişim kaybı, boş yorum listesi, yorum sayfalama; eski üyenin adı bulunamazsa kimlik/yedek etiket göster                             |

Görev listesi pano olarak da gösterilebilir: sütunlar dört durum enum'una karşılık gelir. Sürükle-bırak yalnız `PATCH /tasks/:id` ile durum değiştirir; sütun içi kalıcı sıra alanı yoktur. Sayfalı bir listenin yalnız yüklenmiş bölümünü tam pano diye göstermeyin. Backlog/sprint ekranı için mevcut bir sunucu sözleşmesi bulunmaz.

## 10. İş akışları ve veri güncelliği

### İlk kullanım

1. Kayıt veya giriş ile TokenPair alın; `/auth/me` ile kullanıcıyı yükleyin.
2. Alan listesini yükleyin veya alan oluşturun. Oluşturan otomatik OWNER olur.
3. Alan üye listesinden rolü belirleyin. Arkadaşın hesabı önceden kayıtlı olmalıdır; e-posta ile üyelik ekleme davet e-postası göndermez.
4. OWNER/ADMIN proje oluşturur. Alan üyeleri görev oluşturabilir ve üyelerden birine atayabilir.
5. Başarılı yazma yanıtını ilgili detay önbelleğine aktarın; ilgili liste ve sayaçları yeniden sorgulayın.

### Düzenleme, durum geçişi ve atama

Önce kaydın `updatedAt` değerini alın. PATCH gövdesine bu değeri değiştirmeden `expectedUpdatedAt` olarak ekleyin. Başarıdaki yeni `updatedAt` sonraki işlemde kullanılmalıdır. Görevlerin dört durumu arasında özel geçiş grafiği veya önkoşul yoktur; enum içindeki durumlara doğrudan geçiş yapılabilir. Atamayı kaldırmak için `assigneeId: null` gönderin; alanı hiç göndermemek aynı anlamda değildir.

`409` gelirse eski isteği otomatik olarak yeni sürümle tekrar göndermeyin. Güncel kaydı GET ile alın, kullanıcının taslağını koruyun ve yeniden uygulamayı kullanıcıya bırakın. Sunucu koşullu yazma ile eski sürümü reddeder. Profil ve üyelik değişikliklerinde bu sürüm sözleşmesi yoktur.

### Silme

Alan/proje/görev/yorum silerken `?expectedUpdatedAt=...` kullanın; tarihi URL kodlayın. Üyelik silmede bu parametre yoktur. `204` yanıtını JSON olarak ayrıştırmayın. Silme tamamlandıktan sonra ilgili detaydan çıkın ve üst listeyi yenileyin. Alan silme üyeleri, projeleri, görevleri ve yorumları; proje silme görev ve yorumları; görev silme yorumları kalıcı olarak siler. Geri alma veya çöp kutusu API'si yoktur.

Üst kaydın `updatedAt` değeri, alt kaydın değişmesiyle otomatik yenilenmez. Örneğin yeni yorum, görevin sürümünü değiştirmez. Dolayısıyla sürüm kontrolü alt kaynaklarda eşzamanlı değişiklik yapılmasını topluca denetlemez.

### Üyelik ve yorumlar

Üyelik kaldırılınca o alandaki görev atamaları transaction içinde temizlenir; kişinin oluşturduğu içerikler kalır. Üye listesi ile görev listesi/detaylarını yenileyin. Rol değiştirme yanıtında `user` nesnesi bulunmadığından önceki kullanıcı bilgisini kaybetmeyin veya listeyi yeniden yükleyin. Yorumlar ayrı sayfalı kaynaktır; görev detay yanıtının içinde gelmez. Yalnız yorum yazarı düzenleyebilir; ADMIN olmak düzenleme hakkı vermez.

### İstemci tutarlılığı

Sunucunun `no-store` başlığı frontend kütüphanesinin bellekteki önbelleğini yenilemez. Sorgu anahtarlarına kaynak kimliği, filtre ve sayfayı katın. Alan/proje değişince önceki kapsamdan kalan istekleri iptal edin veya yanıtlarını yok sayın. Aramada gecikmeli sorgu ve eski yanıtları eleme uygulayın. Sekmeye geri dönünce ilgili veriyi yeniden alın; gerçek zamanlı push/WS/SSE sözleşmesi yoktur.

İyimser güncelleme tercih edilirse eski değeri saklayıp hata halinde geri alın; 409'da güncel kaydı yükleyin. Başlangıç entegrasyonunda sunucu yanıtından sonra güncelleme daha basittir. Bağlantı koptuğunda işlemin sunucuda tamamlanıp tamamlanmadığı belirsiz olabilir; özellikle oluşturmayı körlemesine tekrarlamayın. İdempotency anahtarı desteği yoktur.

Tarihleri sunucunun UTC zaman damgasıyla saklayın, kullanıcıya yerel saat diliminde gösterin. `datetime-local` girdisini açık saat dilimi içeren ISO biçimine dönüştürün. `expectedUpdatedAt` için biçimlendirilmiş ekran metni veya tarayıcının güncel saati kullanılmaz. “Son güncelleme” kaydın `updatedAt` değeridir; son veri çekme saati ayrı kavramdır.

## 11. Hata sözleşmesi

```json
{
  "statusCode": 400,
  "message": ["validation message"],
  "error": "Bad Request",
  "timestamp": "2026-09-25T10:00:00.000Z",
  "path": "/tasks/example"
}
```

Bu temsili biçim örneğidir. `message` metin veya metin dizisi olabilir; `path` sorgu parametrelerini içermez. Başarı yanıtları bu zarfa sarılmaz.

| Sonuç     | Frontend davranışı                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| 400       | Alan doğrulaması/yanlış enum/geçersiz ilişkili kaynak; girdiyi koru ve anlaşılır mesaj göster                             |
| 401       | Korumalı istekte bir kez ortak refresh akışı; refresh başarısızsa oturumu kapat. Giriş hatasında refresh döngüsü başlatma |
| 403       | Erişim/rol yetersiz; kapsamı ve üyeliği yeniden değerlendir, başarı bildirimi gösterme                                    |
| 404       | Üye eklemede kullanıcı yok veya ilgili alt kayıt yok; işlem bağlamına uygun mesaj                                         |
| 409       | Yinelenen kayıt veya sürüm çatışması; bağlama göre ayır, çatışmada yeniden yükle                                          |
| 429       | İstek sıklığını azalt, varsa yanıt bekleme bilgisini kullan; otomatik hızlı tekrar yapma                                  |
| 500       | Genel sunucu hatası; girdiyi koru, tekrar deneme sun; ayrıntı/stack bekleme                                               |
| Ağ hatası | HTTP hata gövdesi olmayabilir; bağlantı mesajı göster, yazmanın sonucunu doğrulamadan başarı sayma                        |

Prisma hata eşlemesi: `P2002` → 409 `Resource already exists`; `P2025` → 404 `Resource not found` (sürüm kontrollü yazmada 409); `P2003` → 400 `Invalid related resource`. Diğer beklenmeyen hatalar 500 olur. Metinleri sabit yerelleştirme anahtarı gibi kullanmayın. Kayıt 5/dakika, giriş 10/dakika; diğer rotaların genel sınırı IP/rota başına 120/dakikadır. Bellekteki sınırlayıcının çoklu sunucu arasında ortak sayaç tuttuğunu varsaymayın.

## 12. Uyuşmazlıklar, eksikler ve doğrulama sınırları

| Bulgu                                                                 | Entegrasyona etkisi / kaynak                                                                                |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Swagger'da çoğu yanıtın ayrıntılı modeli yok                          | Controller dönüşleri ve service sorguları esas alınmalı; yalnız Swagger'dan tam tip üretimi eksik kalabilir |
| Sayfalama Swagger açıklamasında üst sınır eksik                       | DTO doğrulamasındaki `page <= 1000000` uygulanır                                                            |
| Sürüm alanının açıklaması ağırlıkla 409'u anlatır                     | Alan zorunludur; eksik/geçersiz sürüm 400'dür; `src/common` sürüm yardımcıları ve DTO'lar                   |
| Üyelik yanıtları aynı şekle sahip değil                               | Liste/ekleme `user` içerir, rol güncelleme içermez; workspaces service                                      |
| ARCHIVED projeye yazmayı engellemez                                   | Arşiv durumunu sunucunun salt okunur kilidi gibi sunmayın; projects/tasks service                           |
| Görev oluştururken geçmiş tarih reddedilir, güncellerken kabul edilir | Form kuralları işlem türüne göre farklıdır; tasks service                                                   |
| Üst kaynak sürümü alt kaynak değişikliklerini kapsamaz                | Toplu silmede alt kayıt değişiklikleri için çatışma garantisi yok; Prisma ilişkileri ve sürüm koşulları     |
| Eski üyelerin görünen adı bulunamayabilir                             | Görev/yorum yanıtları yalnız kullanıcı kimliklerini taşır; herkese açık kullanıcı dizini yok                |
| Üyelik/profil değişiklikleri sürüm kontrollü değil                    | Eşzamanlı değişiklikleri otomatik birleştirme garantisi yok                                                 |

Backend'de görev tipi, etiket, epic, alt görev, sprint, backlog, kalıcı pano sırası, görevleri projeler arası taşıma, dosya yükleme, bildirim, kaydedilmiş filtre/JQL, toplu dashboard istatistikleri, parola sıfırlama, e-posta doğrulama ve sahiplik devri endpoint'leri bulunmuyor. Bunlar bozuk mevcut özellikler değil, mevcut API kapsamı dışındaki özelliklerdir. Temel frontend entegrasyonunu bunlara bağımlı kurmayın.

Tokenların tarayıcıda nerede saklanacağı, frontend yönlendirmeleri ve önbellek kütüphanesi backend tarafından belirlenmez: **Not verified in backend implementation.** Üyelik/rol iptalinin daha önce yetki kontrolünden geçmiş bütün uçuş halindeki istekleri anında durdurması için genel bir atomiklik garantisi: **Not verified in backend implementation.** Canlı sunucu adresi, dağıtım ortamının CORS ayarları, internetten erişim ve gerçek tarayıcı uçtan uca davranışı: **Not verified in backend implementation.**

## 13. Önerilen uygulama sırası

1. `.env.example` ve README ile API'yi yerelde başlatın; frontend origin'ini backend CORS listesine ekleyin. Gizli `.env` dosyasını paylaşmayın.
2. Bölüm 3'teki modelleri ve bölüm 5'teki istek tiplerini tanımlayın; tek API istemcisinde Bearer, hata ayrıştırma ve 204 işlemesini kurun.
3. Kayıt/giriş/profil/çıkış ve eşzamanlı isteklerde tek refresh akışını tamamlayın. Refresh tekrarını sınırlayın.
4. Alan seçimi, alan oluşturma ve üyelikten rol bulmayı uygulayın.
5. Üye yönetimini ve rol bazlı işlem görünürlüğünü ekleyin; sunucunun 403 yanıtlarını yine ele alın.
6. Proje listeleme/oluşturma/detay/düzenleme/silmeyi sürüm sözleşmesiyle bağlayın.
7. Görev listesi, arama, filtre, sıralama, sayfalama ve oluşturmayı bağlayın.
8. Görev detayını, durum değişimini, atamayı ve yorumları tamamlayın.
9. Mutasyon sonrası liste/detay yenilemeyi, sekmeye dönüşte yeniden yüklemeyi ve 409 çözümünü uygulayın.
10. İzole hesap/alan ile boş liste, 400, 401, 403, 409, 429, ağ kesintisi, silme zinciri ve iki istemcili eski sürüm senaryolarını doğrulayın. Gerçek kullanıcı verisi üzerinde silme testi yapmayın.

## 14. Kaynak ve doğrulama notu

Belge kontrolünde controller tanımlarından çıkarılan 31 yöntem/yol ile API tablosu otomatik karşılaştırıldı; eksik veya fazladan işlem bulunmadı. `npm run test:e2e` ayrı geçici SQLite veritabanında çalıştırıldı: **1 test paketi, 19 test geçti**. Test çıktısındaki `isolated database outage`, sunucu hatasını sınamak için bilerek üretilir. Belge Prettier ile biçimlendirildi. Bu çalışmada tarayıcı testi yapılmadı.

Bu belge `src/auth`, `src/users`, `src/workspaces`, `src/projects`, `src/tasks`, `src/comments`, `src/common`, uygulama kurulum dosyaları, `prisma/schema.prisma` ve test kaynakları incelenerek hazırlanmıştır. Envanterde Swagger servis rotaları hariç **31 API işlemi** ve frontend için **10 ekran grubu** vardır. İsteklerin çalışacağı ortamın yapılandırılması ve frontend tarayıcı doğrulaması ayrıca gereklidir. Belge hazırlanırken backend davranışı değiştirilmemiştir.
