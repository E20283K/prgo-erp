# Mijozga jo'natish jarayoni — Audit va tuzatish rejasi

> Qamrov: tayyor mahsulot (2810) va aksessuarlarni (2910) mijozga jo'natish. Bunga chiqim hujjati, skaner, reys (manifest), schet-faktura va savdo hujjati bilan bog'lanish kiradi.
> Asos: [WAREHOUSE.md](./WAREHOUSE.md). Sana: 2026-11-12.

---

## 1. Hozirgi jarayon

```
Buyurtma (WO) / Savdo (TS) / Mijoz kartasi
        │  chiqim qoralamasi
        ▼
Chiqim SHP  Draft ──► Packed ("Tayyor yuk") ──► Dispatched ("Chiqarish") ──► Delivered
        │                                        │
        │ skaner: quti, WO, savdo stikeri, SKU   ├─ qoldiq: 2810 FG / 2910 katalog / 1010 xomashyo
        │ tanlash: FG, 2910 katalog, xomashyo    ├─ savdo hujjati → Posted + settlement
        ▼                                        └─ Schet-faktura SF (avto)
Reys MNF ──(Dispatched)──► biriktirilgan chiqimlarni kaskad o'tkazadi
```

## 2. To'g'ri ishlayotgan joylar

| Joy | Nega yaxshi |
|---|---|
| Chiqim bir marta o'tkaziladi (`wasAlreadyDispatched` himoyasi) | Qayta saqlashda qoldiq ikki marta yechilmaydi |
| Hisob kodlari 1010 / 2810 / 2910 qator darajasida | Buxgalteriya to'g'ri ajratilgan, aralash yuk mumkin |
| Bitta hujjatda tayyor mahsulot va aksessuar birga | Mijozga bitta yuk xati bilan yetkaziladi |
| Shtrix-kod skaneri (USB HID tinglovchi) | Omborchi klaviaturasiz ishlay oladi |
| Boshqa mijozning qutisi skanerlansa ogohlantirish va reorder WO | Re-allocation boshqariladi |
| Avto schet-faktura va savdo hujjatining `Posted` bo'lishi (idempotent) | Moliya va savdo ombor bilan sinxron |
| Transport tanlovi waybill yaratilishidan ajratilgan (`c19d3ef`) | Manifestsiz to'g'ridan-to'g'ri jo'natish mumkin |
| UI zich (h-7, text-xs), Glide grid | Anti-slop standartiga mos |

## 3. Topilgan xatolar

### 3.1 Bu sessiyada tuzatilganlar

| # | Xato | Tuzatish | Fayl |
|---|---|---|---|
| F1 | Qoldiq tekshirilmasdi: yo'q mahsulot ham "jo'natilardi", qoldiq jimgina 0 ga qirqilardi | `assertShipmentStockAvailable`: o'tkazishdan oldin har SKU bo'yicha umumiy miqdor tekshiriladi. Yetishmasa **hech narsa yozilmaydi** va aniq xabar qaytadi | `warehouseService.ts` |
| F2 | "Qaytarish" (Dispatched → Packed) qoldiqni tiklamasdi, qayta chiqarish **ikki marta** yechardi | Storno: qoldiq va qutilar holati qaytariladi. Tugma "Storno" deb nomlandi va tasdiq so'raydi | `warehouseService.ts`, `WarehouseShipmentDetail.tsx` |
| F3 | FG 0 ga tushganda enumda yo'q `"Out of Stock"` yozilardi → Postgres xatosi, hujjat yarim saqlanardi | `Shipped` / `In Stock` | `warehouseService.ts` |
| F4 | `tradingCatalogId` sifatida SKU kelganda (savdo stikeri) uuid ustunida qidiruv → SQL xato | UUID tekshiruvi, keyin SKU bo'yicha | `findTradingCatalogRow` |
| F5 | `finishedGoodId` siz 2810 qatori qoldiqqa ta'sir qilmasdi | SKU (+ WO) bo'yicha FG topiladi | `findFinishedGoodRow` |
| F6 | 2810 chiqimda `stock_balances` dagi FG qoldig'i kamaymasdi | O'sha yerda ham aks ettiriladi (faqat qator mavjud bo'lsa) | `applyShipmentLineStockEffect` |
| F7 | Xomashyo qatoriga hisob qo'yilmasdi → default 2810 → xomashyo kamaymasdi | Picker `1010` qo'yadi; serverda tasnif: kod > katalog > FG > chiqim turi | `resolveShipmentAccount` |
| F8 | Reys jo'natilganda bitta chiqimda xato bo'lsa, reys yarim holatda qolardi | Barcha chiqimlar qoldig'i manifest yozilishidan oldin tekshiriladi | `upsertDispatchManifest` |
| F9 | Skaner kompaniyani yubormasdi (doim `PRINTGOO`) | `companyId` yuboriladi, server UUID ni ham qabul qiladi | `scan-box/route.ts` |
| F10 | Katalog SKU skanerlansa butun qoldiq (1000 tagacha) qo'shilardi | 1 skan = 1 birlik | `lookupBoxOrWorkOrderBarcode` |
| F11 | Savdo stikeri, chiqim faqat qoralama bo'lsa ham, "allaqachon chiqarilgan" deb rad etilardi | Faqat o'tkazilgan chiqim hisobga olinadi | ″ |
| F12 | Quti shtrix-kodi regex `d` (`\d` emas) — pattern bosqichi ishlamasdi | `\d{1,3}` | ″ |
| F13 | Server xato matni foydalanuvchiga yetmasdi (umumiy "Saqlashda xatolik") | Store `{success,error}` qaytaradi, UI aniq xabar ko'rsatadi | `workspaceStore.ts`, `WarehouseShipmentDetail.tsx` |
| F14 | WO partiyasidan chiqim client tomonda `SHP-6010` kabi soxta raqam bilan, partiya esa qoralamada "dispatched" deb belgilanardi | Raqamni server beradi (`SHP-YY-NNNN`), partiya `ready` bo'ladi | `WorkOrderDetail.tsx` |
| F15 | Bo'sh, 0 miqdorli yoki qabul qiluvchisiz chiqimni o'tkazish mumkin edi | Server validatsiyasi | `upsertWarehouseShipment` |

Modul bo'yicha qo'shimcha tuzatishlar (WAREHOUSE.md §6 dan): FG `PendingReceipt` va tannarx saqlanadi (#1), FG qabulini qayta tasdiqlashdan himoya qo'shildi. Qayta saqlashda kirim, ko'chirish va inventarizatsiya qoldiqqa ikkinchi marta ta'sir qilmaydi (#3). Kirim bildirishnomasi `Accepted` statusida chiqadi (#8). Manifestdagi o'lik `InTransit` sharti olib tashlandi (#9). Inventarizatsiya `INV-YY-NNNN` raqam oladi (#11). Kompaniya qidiruvi UUID'ni ham qabul qiladi (#16 qisman).

> Tekshiruv: `tsc --noEmit` toza. Jonli DB'da yozuvchi sinov **o'tkazilmagan**, chunki trading katalog bo'sh va mavjud ma'lumotni o'zgartirmaslik uchun.

### 3.2 Hali qolganlar (rejaga kiritilgan)

| # | Muammo | Ta'siri |
|---|---|---|
| R1 | Tranzaksiya yo'q (`db.transaction`) | Tarmoq yoki DB xatosida qisman yozuv. F1/F8 xavfni kamaytiradi, lekin yo'q qilmaydi |
| R2 | Rezervatsiya yo'q: "Tayyor yuk" (Packed) qoldiqni band qilmaydi | Ikki omborchi bir zaxirani ikki chiqimga qo'yishi mumkin; xato faqat "Chiqarish" bosilganda chiqadi |
| R3 | Chiqim `clientId` ni o'rnatmaydi (mijoz matn bilan tanlanadi) | CRM, schet-faktura va settlement nom bo'yicha moslanadi; nom o'zgarsa bog'lanish uziladi |
| R4 | Soxta default ma'lumotlar: `DEFAULT_CARRIERS` (ism-familiyali haydovchilar), `wh-1`, filial/vendor ro'yxatlari | Haqiqiy bo'lmagan haydovchi hujjatga tushadi |
| R5 | Og'irlik/qutilar taxminiy (`qty*0.045`, `qty/500`) | Yuk xati va manifestda noto'g'ri og'irlik |
| R6 | "Yetkazildi" uchun qabul tasdig'i (POD) yo'q: imzo, rasm, qabul qiluvchi, vaqt | Nizoli holatda dalil yo'q |
| R7 | Storno moliya tomonni qaytarmaydi (SF, settlement, savdo `Posted` qoladi) | Buxgalter qo'lda tuzatadi |
| R8 | Qisman jo'natish yo'q: `orderQty` va `shippedQty` bir xil, qoldiq (backorder) kuzatilmaydi | Bo'lib jo'natishda buyurtma holati noaniq |
| R9 | `WarehouseShipmentDetail.tsx` 3600 qator, bitta komponent | O'zgartirish xavfli, test yo'q |
| R10 | Ombor ro'yxati ikki manbadan (plant JSONB va `warehouses`) va `from` matn sifatida | 1010 qoldiq kaliti nom bo'yicha; nom farqi qoldiqni "yo'qotadi" |
| R11 | Mavjud ma'lumot: `SHP-26-0001` dagi aksessuar SKU (`BTN-MET-18MM`) `2810` bilan yozilgan | Yangi validatsiya bunday qatorni FG topilmasa rad etadi |

---

## 4. Maqsadli jarayon (jahon standarti: Order → Pick → Pack → Ship → POD)

SAP EWM, Odoo Inventory va 1C:УТ dagi umumiy amaliyotga asoslangan.

```
 Rezerv             Terish (Pick)           Qadoqlash (Pack)         Jo'natish (Ship)              Yetkazish (POD)
 ─────────          ────────────            ────────────────         ──────────────────            ───────────────
 Draft  ──Tasdiqlash──► Reserved ──Terish ro'yxati──► Picking ──Skan──► Packed ──Reys/kuryer──► Dispatched ──► Delivered
   │                  (qoldiq band)          (katak bo'yicha)        (qutilar, og'irlik,         (SF, savdo,       (imzo, rasm,
   │                                                                  yuk xati)                   settlement)       qabul qiluvchi)
   └──────────── Bekor qilish (istalgan bosqichda; Dispatched'dan keyin faqat storno + moliya storno)
```

Asosiy tamoyillar:
1. **Manfiy qoldiq taqiqlangan.** Qoldiq tasdiqlashda band qilinadi va jo'natishda yechiladi.
2. **Hujjat holati — yagona haqiqat manbai.** Har o'tishni faqat server bajaradi. UI qoldiqni optimistik hisoblamaydi.
3. **Har o'tish atomar** (`db.transaction`). Effektlar idempotent: chiqim, moliya va savdo.
4. **Skan-tasdiq:** jo'natishdan oldin har qator skan bilan tasdiqlanadi (opsional, sozlamada yoqiladi).
5. **Audit:** kim, qachon, qaysi o'tish (haqiqiy `userId`).

---

## 5. Tuzatish rejasi (bosqichlar)

### 1-bosqich — Ma'lumot yaxlitligi (backend) · **bajarildi (2026-11-12)**

Amalga oshirilgan:

| Vazifa | Joy |
|---|---|
| Holat mashinasi: `Draft → Reserved → Picking → Packed → Dispatched → In Transit → Delivered`, `Cancelled`; noto'g'ri o'tish → 409 | `lib/server/shipmentEngine.ts` (`ALLOWED_TRANSITIONS`) |
| Rezervatsiya: `Reserved/Picking/Packed` qoldiqni band qiladi (2910 `trading_catalog.reserved_qty`, 2810 `reserved_quantity`, 1010 `reserved`). Qatorlar `SELECT … FOR UPDATE` bilan qulflanadi | `reserveLines`, `postLines` |
| Butun chiqim bitta `db.transaction` da: qoldiq, qatorlar, qutilar, savdo hujjati, SF, audit. Bildirishnomalar commit'dan keyin yuboriladi | `upsertWarehouseShipmentTx`, `upsertWarehouseShipment` |
| Reys kaskadi bitta tranzaksiyada: biror chiqim o'tmasa, butun reys bekor bo'ladi | `upsertDispatchManifest` |
| To'liq storno: qoldiq qaytadi, SF `cancelled` (imzolangan bo'lsa rad etiladi), mijoz balansi qayta hisoblanadi, savdo `Draft` ga qaytadi, settlement va YTT aylanmasi teskari yoziladi. Qayta jo'natishda o'sha SF raqami qayta faollashadi | `cancelDeliveryAct`, `reverseSalePostedEffects` |
| `clientId`: payload → nom → savdo hujjati → WO bo'yicha aniqlanadi. `CustomerDelivery` ni band qilish yoki jo'natish CRM mijozisiz rad etiladi | `resolveShipmentClientId` |
| SF bog'lanishi: chiqimda SF `docNo` saqlanadi (oldin UUID edi va UI aktni topa olmasdi), `delivery_acts.linked_shipment_id` to'ldiriladi | `upsertWarehouseShipmentTx` |
| Audit: haqiqiy foydalanuvchi (sessiya), `post`/`unpost` amallari; API 409/422 qaytaradi | `lib/server/requestActor.ts`, routes |
| Schema: `0005_shipment_reservation.sql` + db:push bazalar uchun `scripts/apply-shipment-reservation.ts` | |
| Tasnif auditi: `scripts/audit-shipment-accounts.ts` (dry-run / `--apply`, faqat Draft/Cancelled) | |
| Testlar: `scripts/test-shipment-flow.ts` — 13 ta ssenariy, har biri rollback qilinadi | |
| UI: `Band qilish`, `Bekor qilish`, `Qayta ochish` tugmalari, yangi status badge'lar, mijoz tanlanganda `clientId` | `WarehouseShipmentDetail.tsx` |

Qolganlar (P2 ga o'tkazildi): SF va hujjat raqamlari tranzaksiyadan tashqarida generatsiya qilinadi (parallel yaratishda to'qnashuv xavfi — sequence yoki advisory lock kerak). Real ikki-sessiyali parallel rezerv testi yozilmagan (qulf `FOR UPDATE` bilan ta'minlangan). Savdo hujjati bilan bog'liq ssenariy testda yo'q. Client store'dagi `postDeliveryAct` hali ham client tomonda chiqim yaratadi.

Dastlabki reja:

| Vazifa | Natija |
|---|---|
| `upsertWarehouseShipment` ni `db.transaction` ga o'tkazish (helperlar `tx` qabul qiladi; `upsertDeliveryAct` va `applySalePostedEffects` ham) | R1 yopiladi |
| Holat mashinasi: ruxsat etilgan o'tishlar jadvali (`Draft→Reserved→Picking→Packed→Dispatched→Delivered`, `Cancelled`). Noto'g'ri o'tishda 409 | Tasodifiy holat sakrashlari yo'q |
| Rezervatsiya: `Reserved` da `finished_goods.reserved_quantity`, `stock_balances.reserved`, `trading_catalog` uchun `reserved_qty` ustuni (migration). Bekor qilish yoki jo'natishda rezerv bo'shatiladi | R2 |
| Storno to'liq: SF holati `Cancelled` (yoki teskari akt), settlement teskari yozuv, savdo `Draft`/`Confirmed` ga qaytadi | R7 |
| `clientId` majburiy (`CustomerDelivery` uchun); server nom bo'yicha topa olsa avto-to'ldiradi | R3 |
| Mavjud noto'g'ri tasniflangan qatorlar uchun migratsiya skripti (dry-run va hisobot) | R11 |
| Vitest: holat o'tishlari, qoldiq, storno, manifest kaskadi bo'yicha integratsion testlar (test DB) | Regressiyadan himoya |

### 2-bosqich — UI/UX qayta qurish · ~5-6 kun

`WarehouseShipmentDetail.tsx` quyidagi qismlarga bo'linadi (R9):

```
shipment/
  ShipmentDetail.tsx          — layout + holat
  ShipmentHeader.tsx          — raqam, holat badge, bog'lanishlar, asosiy harakat tugmasi
  ShipmentStepper.tsx         — Rezerv · Terish · Qadoq · Jo'natish · Yetkazish
  ShipmentRequisites.tsx      — mijoz (CRM combobox, clientId), ombor (warehouses.id), turi
  ShipmentLinesGrid.tsx       — qatorlar: hisob badge (2810/2910/1010), mavjud qoldiq ustuni, defitsit belgisi
  ShipmentScanPanel.tsx       — skan maydoni, oxirgi skanlar, tovush/vibratsiya signali
  ShipmentTransportPanel.tsx  — reys, kuryer yoki o'zi olib ketish
  ShipmentPodDialog.tsx       — yetkazish tasdig'i
  useShipmentDoc.ts           — state + server sinxron
```

UX qoidalari (AGENTS.md anti-slop standartiga mos):

| Element | Yechim |
|---|---|
| Asosiy harakat | Har holatda **bitta** asosiy tugma: `Tasdiqlash` → `Terish` → `Qadoqlash` → `Jo'natish` → `Yetkazildi`. Ikkilamchi harakatlar `...` menyusida (`Storno`, `Bekor qilish`, `Nusxa`) |
| Stepper | Sarlavha ostida 5 bosqichli ingichka stepper (`h-6`, `text-[11px]`), joriy bosqich `bg-primary` |
| Qoldiq ko'rinishi | Qatorda `Mavjud` ustuni; yetishmasa qizil matn va `AlertTriangle` (size-3.5). Kiritish paytida tekshiriladi, "Jo'natish" bosilgunicha kutilmaydi |
| Server xatolari | Toast + qatorni belgilash (qaysi SKU yetishmaydi) |
| Skaner | Doimiy fokuslangan skan maydoni, oxirgi 5 skan ro'yxati. Muvaffaqiyat yashil chaqnash, xato qizil + tovush. Aksessuar uchun miqdorni `×N` bilan kiritish (masalan `12*BTN-MET-18MM`) |
| Aralash yuk | Qatorlar hisob bo'yicha guruhlanadi: "Tayyor mahsulot (2810)" va "Aksessuarlar (2910)"; har guruhda oraliq jami |
| Transport | Uchta segment: `Reys` / `Kuryer` / `O'zi olib ketadi`. Faqat DB'dagi tashuvchilar; soxta defaultlar o'chiriladi (R4) |
| Og'irlik/hajm | `items` / `trading_catalog` dagi birlik og'irligidan hisoblanadi; bo'lmasa qo'lda kiritish, taxminiy qiymat yo'q (R5) |
| Bog'langan hujjatlar | Sarlavhada chiplar: `WO`, `TS`, `MNF`, `SF`, bosilsa tab ochiladi |
| Klaviatura | `Ctrl+S` saqlash, `Ctrl+Enter` asosiy harakat, `F2` skan maydoni |
| Bo'sh holat | Qatorlar bo'lmasa: "Skanerlang yoki tanlang" va ikkita tugma (`Tayyor mahsulot`, `Aksessuar`) |

### 3-bosqich — Hujjatlar va yetkazish · ~3 kun

| Vazifa | Natija |
|---|---|
| Yuk xati (TTN) — O'zbekiston standart shakli: jo'natuvchi va qabul qiluvchi STIR, avtomobil, haydovchi, ishonchnoma; A4 PDF (`doc-service`) | Rasmiy hujjat |
| Qadoq varag'i (packing list) — quti bo'yicha tarkib | Mijoz qabulida tekshiruv |
| Quti yorlig'i (SSCC uslubidagi kod + QR: `SHP`, quti №, mijoz) | Skan bilan qabul |
| POD dialogi: qabul qiluvchi FIO, ishonchnoma №, sana-vaqt, imzo (canvas) va rasm (storage) | R6 |
| Qisman jo'natish: `orderQty` va `shippedQty` ajratiladi, qoldiq uchun avtomatik "backorder" chiqim qoralamasi | R8 |

### 4-bosqich — Reyslar va kuzatuv · ~2-3 kun

| Vazifa | Natija |
|---|---|
| Reys rejalashtirish ko'rinishi: kun bo'yicha mashinalar, sig'im (kg/m³) va to'lish foizi | Logistika rejasi |
| Marshrut ketma-ketligi va har to'xtashda POD | Ko'p mijozli reys |
| Telegram orqali mijozga xabar: "Yukingiz yo'lda" (mavjud `telegramService`) | Mijoz tajribasi |
| Ombor ro'yxatini bitta manbaga keltirish (`warehouses` jadvali; plant JSONB faqat ko'rinish) | R10 |

---

## 6. Ustuvorlik

| Ustuvorlik | Ish | Nega |
|---|---|---|
| **P0** (bajarildi) | F1–F15 | Qoldiq buzilishi va xatolarni darhol to'xtatish |
| **P1** | 1-bosqich: tranzaksiya, holat mashinasi, rezerv, to'liq storno, `clientId` | Ma'lumot ishonchliligi, UI bunga tayanadi |
| **P2** | 2-bosqich: UI bo'linishi, stepper, qoldiq ustuni, skan paneli | Omborchining kundalik ishi |
| **P3** | 3-bosqich: TTN, packing list, POD | Rasmiy hujjat aylanishi |
| **P4** | 4-bosqich: reys rejalashtirish, kuzatuv | Masshtab |

## 7. Qabul mezonlari (P1+P2 uchun)

- Mavjud qoldiqdan ko'p miqdorni jo'natib bo'lmaydi. Xabar qaysi SKU va qancha yetishmasligini aytadi.
- Storno → qayta jo'natish → qoldiq bir marta kamaygan, SF bitta, settlement bitta.
- Reysdagi bitta chiqim muammoli bo'lsa, reys va boshqa chiqimlar o'zgarmaydi.
- Ikki foydalanuvchi bir FG ni rezerv qilishga urinsa, ikkinchisi rad etiladi.
- 2810 + 2910 aralash chiqim: har hisob o'z registridan kamayadi, SF'da barcha qatorlar bor.
- Barcha o'tishlar audit logda haqiqiy foydalanuvchi bilan yoziladi.
