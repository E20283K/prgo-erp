# PrintGoo ERP — Ma'lumotlar Bazasi Sxemasi va Hujjatlar Arxitekturasi

Ushbu hujjat PrintGoo ERP tizimining relyatsion tuzilmasi, registrlar mantig'i va hujjatlar o'rtasidagi munosabatlarni AI Copilot uchun to'liq tavsiflaydi.

---

## 1. Hujjatlar Turlari va Prefikslar Standarti

| Prefiks | Hujjat Turi | Modul / Submodul | Asosiy Registr / Jadval | Ta'rifi |
|---|---|---|---|---|
| `WOOF` | Ofset buyrug'i | `production / queue` | `work_orders` | Varaqli ofset bosma buyurtmasi (kitob, katalog, buklet, etiketka, quti) |
| `WOFL` | Flekso buyrug'i | `production / queue` | `work_orders` | Rulonli fleksografik bosma buyurtmasi (o'ziyopishqoq etiketka, BOPP plyonka) |
| `WODG` | Raqamli bosma buyrug'i | `production / queue` | `work_orders` | Tezkor raqamli bosma (kichik tiraj, personifikatsiya) |
| `SPEC` | Texnologik karta / BOM | `production / specifications` | `product_specifications` | Mahsulot retsepti, xomashyo sarf me'yorlari, marshrut xaritasi |
| `RCV` | Kirim orderi (M-4) | `warehouse / receipts` | `warehouse_receipts` | Xomashyo yoki yarimfabrikatlarning omborga qabul qilinishi |
| `SHP` | Chiqim orderi (M-11) | `warehouse / shipments` | `warehouse_shipments` | Xomashyoni ishlab chiqarishga yoki tayyor mahsulotni mijozga jo'natish |
| `ACT` | Topshirish dalolatnomasi | `finance / delivery-acts` | `delivery_acts` | Bajarilgan ishlar topshirish dalolatnomasi va hisob-faktura (1C) |
| `INV` | To'lov hisobvarag'i | `finance / invoices` | `invoices` | Mijozga to'lov uchun chiqarilgan oldindan to'lov hisobi |
| `TRF` | Operatsiya tarifi | `settings / tariffs` | `tariffs` | Texnologik operatsiya va mehnat haqi tarifi |

---

## 2. Ishlab Chiqarish Buyrug'i (`work_orders`) Relyatsiyalari

### Asosiy Maydonlar:
- `id` / `docNo` (string, PK) — Hujjat raqami (masalan: `WOOF-26-0351`)
- `companyCode` (string) — Korxona kodi (`PRINTGOO`)
- `customerId` / `customer` (string) — Buyurtmachi korxona nomi va STIR (INN)
- `product` (string) — Mahsulot nomi va tavsifi
- `quantity` (number) — Buyurtma tiraji (dona yoki metr)
- `unit` (string) — O'lchov birligi (`pcs`, `m`, `kg`, `sheets`)
- `status` (enum) — `Draft` | `Active` | `Completed` | `Cancelled`
- `priority` (enum) — `Normal` | `High` | `Urgent`
- `stage` (enum) — Ishlab chiqarish bosqichi:
  1. `Queue` — Navbatda (CTP yoki xomashyo kutilmoqda)
  2. `Ready to Print` — Barcha xomashyo va CTP plastinalar tayyor
  3. `In Production` — Dastgohda bosilmoqda
  4. `Post-press` — Bosmadan keyingi ishlov (kesish, laminatsiya, lak, shtamp, buklash)
  5. `Packaging` — Qadoqlash va sifat nazorati (OTK)
  6. `Completed` — Bajarilgan, omborga qabul qilingan
  7. `On Hold` — To'xtatilgan (klient o'zgartirishi yoki to'lov kechikishi tufayli)
- `pressMachine` (string) — Biriktirilgan bosma mashinasi
- `startDate` / `deadline` (date) — Boshlanish va yakuniy topshirish sanasi
- `paperStock` (string) — Ishlatiladigan qog'oz / plyonka markasi va zichligi
- `priceTotal` / `currency` (number/string) — Shartnoma qiymati va valyutasi (USD / UZS)
- `operator` (string) — Mas'ul usta yoki smena boshlig'i

---

## 3. 1C Jamg'arma Registrlari Mantig'i (Accumulation Registers)

### A. Ombor Qoldiqlari Registri (`warehouse_stock_balances`):
- `TotalStock` (Jismoniy mavjud qoldiq) — ombordagi haqiqiy faktik miqdor.
- `ReservedStock` (Band qilingan qoldiq) — faol tasdiqlangan ishlab chiqarish buyruqlariga biriktirilgan xomashyo.
- `FreeStock` (Erkin qoldiq) = `TotalStock - ReservedStock`.
- **Kritik defitsit qoidasi:** Agar `FreeStock <= MinThreshold` bo'lsa, tizimda darhol "Xomashyo defitsiti" ogohlantirishi paydo bo'ladi. Yangi buyurtma ochishdan oldin ta'minotchi bilan shartnoma tekshirilishi lozim.

### B. Mijozlar va Yetkazib Beruvchilar Bilan Hisob-Kitob Registri (`settlements`):
- `Debit` (Debet) — Mijozga yuklab berilgan tovarlar yoki ko'rsatilgan xizmatlar (ACT).
- `Credit` (Kredit) — Mijozdan kelib tushgan to'lovlar (Bank ko'chirmasi / Kassa).
- `ClosingBalance` (Yakuniy saldo):
  - `ClosingBalance > 0` bo'lsa: Mijozning korxonadan qarzi bor (Debitorlik).
  - `ClosingBalance < 0` bo'lsa: Mijoz avans to'lagan (Kreditorlik).
  - `ClosingBalance = 0` bo'lsa: To'liq hisob-kitob qilingan.

---

## 4. Dastgohlar va Telemetriya (`machine_telemetry`):
- `Availability` (Vaqt unumdorligi) = Ishlagan vaqti / Rejalashtirilgan vaqt.
- `Performance` (Tezlik unumdorligi) = Haqiqiy bosma tezligi / Pasport tezligi.
- `Quality` (Sifat koeffitsienti) = (Jami mahsulot - Brak) / Jami mahsulot.
- `OEE` (Overall Equipment Effectiveness) = `Availability * Performance * Quality * 100%`.
- Sanoat etaloni: OEE >= 85% — jahon darajasidagi yuqori unumdorlik.
