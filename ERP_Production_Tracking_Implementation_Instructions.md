# ERP Production Tracking — Implementation Instruction

## 1. Maqsad

ERP tizimida bosmaxona ishlab chiqarishini fizik jarayonga mos, sodda va kuzatiladigan tarzda boshqarish modulini ishlab chiqish.

Tizim kichik va o‘rta bosmaxonalar uchun mo‘ljallangan. Sexda faqat bitta markaziy kompyuter mavjud bo‘lishi mumkin. Har bir operator uchun alohida kompyuter yoki planshet talab qilinmaydi.

Asosiy prinsiplar:

- Buyurtma, ishlab chiqarish partiyasi, operatsiya va fizik material bir-biridan alohida tushunchalar bo‘lsin.
- Har bir operatsiya o‘ziga mos ishlab chiqarish hisobiga ega bo‘lsin.
- Bir operatsiyada bir nechta operator birgalikda ishlay olsin.
- Operatorlardan real bo‘lmagan darajada aniq yoki ko‘p ma’lumot kiritish talab qilinmasin.
- Hisob-kitob fizik material harakati, standart bog‘lamlar, palletlar va yakuniy reconciliation orqali yuritilsin.
- Brak, chiqindi va izohlanmagan farq bir-biriga aralashtirilmasin.
- Hech qanday miqdor tizimda dalilsiz avtomatik ravishda yaxshi mahsulot yoki brak deb belgilanmasin.

## 2. Asosiy biznes obyektlari

### 2.1 Sales Order

Mijoz buyurtmasi. Tijorat buyurtmasi va mijoz talablarini saqlaydi.

### 2.2 Production Order

Buyurtmani ishlab chiqarish uchun topshiriq. Sales Order bilan bog‘lanadi. Bitta Sales Order bir nechta Production Order yoki ishlab chiqarish partiyasiga ajralishi mumkin.

### 2.3 Production Batch

Bir xil mahsulot va texnologik yo‘nalish bo‘yicha birga ishlab chiqariladigan partiya. Operatsiyalar, material sarfi va miqdorlar partiya kesimida kuzatiladi.

### 2.4 Routing

Mahsulot o‘tishi kerak bo‘lgan operatsiyalar ketma-ketligi. Masalan:

Prepress → Offset → Lamination → Die-cutting → Gluing → Final Packing → Finished Goods.

Routing moslashuvchan bo‘lsin: operatsiyalar mahsulotga qarab qo‘shilishi, olib tashlanishi yoki tartibi o‘zgarishi mumkin.

### 2.5 Work Center

Sex, uskuna yoki ishlab chiqarish ish joyi. Masalan: Offset Press 1, Laminator 1, Die-cutting 1, Gluing, Packing.

### 2.6 Operation Batch

Muayyan Production Batch doirasidagi bitta operatsiya bajarilishi. Unda rejalashtirilgan miqdor, real input, output, brak, vaqt, mas’ullar va status saqlanadi.

### 2.7 Handling Unit (HU)

Fizik material tashuvchi birlik. Faqat pallet bilan cheklanmasin. Quyidagi turlarni qo‘llab-quvvatlasin:

- Pallet
- Bundle / bog‘lam
- Carton / quti
- Container / konteyner
- Loose material / alohida material

Har bir HU uchun unikal ID bo‘lsin. QR yoki barcode yorlig‘i chop etish imkoniyati yaratilishi kerak. QR/barcode — identifikatsiya vositasi; u o‘z-o‘zidan miqdorni tasdiqlamaydi.

### 2.8 Operation Report

Operatsiya natijasini qayd etuvchi hujjat. Hisobotni bitta mas’ul xodim kiritishi mumkin. Bir nechta operator bitta Operation Batch ustida ishlashi mumkin.

### 2.9 WIP Transfer

Yarim tayyor mahsulotni bir Work Center yoki saqlash joyidan boshqasiga topshirish va qabul qilish hujjati.

### 2.10 Material Consumption

Operatsiyada sarflangan xomashyo va yordamchi materiallar harakati. Kashirovkada, masalan, bosma list va gofrokarton alohida material sifatida hisoblanadi.

### 2.11 Quality / Scrap / Variance

- Good Output: yaroqli mahsulot.
- Recorded Scrap: amalda aniqlangan va qayd etilgan brak yoki chiqindi.
- Rework: qayta ishlashga yuborilgan mahsulot.
- Remaining Material: ishlatilmay qolgan va saqlanayotgan material.
- Unaccounted Variance: input va izohlangan output o‘rtasidagi aniqlanmagan farq.

Bu ko‘rsatkichlar alohida saqlansin.

## 3. Fizik ishlab chiqarish modeli

### 3.1 Markaziy kompyuter modeli

Birinchi versiyada operatorlarga alohida qurilma shart emas.

- ERP ma’lumotlarini dispetcher, sex boshlig‘i yoki tayinlangan mas’ul xodim kiritadi.
- Har bir Production Order uchun chop etiladigan Production Job Card yaratiladi.
- Job Card mahsulot yoki pallet/bog‘lam bilan birga sexlar orasida harakatlanadi.
- Operator bajarilgan ishni kartaga yozishi mumkin.
- Mas’ul xodim belgilangan vaqtda yoki operatsiya tugaganda natijani ERP'ga kiritadi.
- Keyingi bosqichda umumiy planshet yoki telefon orqali QR scan qo‘shish mumkin.

ERP qog‘oz karta va raqamli ma’lumotlar o‘rtasidagi farqni audit trail orqali kuzatsin.

### 3.2 Production Job Card

Chop etiladigan karta kamida quyidagilarni o‘z ichiga olsin:

- Production Order ID
- Sales Order ID
- Mahsulot nomi va kodi
- Rejalashtirilgan miqdor
- Material va o‘lcham
- Routing / operatsiyalar ro‘yxati
- Joriy operatsiya
- Handling Unit ID yoki partiya identifikatori
- Keyingi operatsiya
- Operator/mas’ul uchun qayd maydoni
- Sana va imzo maydoni
- QR/barcode

Karta ma’lumotlari ERP'dan avtomatik to‘ldirilsin.

### 3.3 Pallet va bog‘lamlar

- Partiya bir nechta Handling Unit'ga bo‘linishi mumkin.
- Bitta Handling Unit bir nechta kichik HU'ga ajratilishi mumkin.
- Bir nechta HU bitta operatsiyada birgalikda qayta ishlanishi mumkin.
- Bir nechta HU birlashtirilib yangi HU hosil qilinishi mumkin.
- Parent-child genealogy saqlansin: yangi HU qaysi oldingi HU'lardan hosil bo‘lganini ko‘rsatish.
- HU miqdori va o‘lchov birligi aniq bo‘lsin: list, dona, kg, bundle va hokazo.
- Bir HU ichidagi miqdor noma’lum bo‘lsa, tizim taxminiy miqdorni aniq miqdor sifatida ko‘rsatmasin.

## 4. Operatsiyalarni bajarish va hisobga olish

### 4.1 Umumiy Operation Batch maydonlari

Har bir operatsiyada quyidagi umumiy maydonlar bo‘lsin:

- Operation Batch ID
- Production Order / Batch
- Operation Type
- Work Center / Machine
- Planned Input
- Actual Input
- Good Output
- Recorded Scrap
- Rework Quantity
- Remaining Material
- Unaccounted Variance
- Start / End time
- Responsible operator
- Additional operators / team members
- Notes
- Attachments yoki QC evidence (ixtiyoriy)
- Status: Planned, Ready, In Progress, Partially Completed, Completed, On Hold, QC Hold, Cancelled

Operatorlar ro‘yxati bitta operatsiya batch'iga bog‘lansin. Ularning ish vaqti yoki individual unumdorligi alohida talab qilinmasa, har bir operator uchun alohida ishlab chiqarish output yozuvi yaratilmasin.

### 4.2 Die-cutting

Hisob birligi odatda list yoki bog‘lam bo‘lsin. Agar bitta listdan bir nechta mahsulot chiqsa, conversion factor saqlansin.

Kiritiladigan ma’lumotlar:

- Input sheets
- Good sheets / good pieces
- Recorded scrap sheets
- Rework sheets
- Remaining sheets
- Unaccounted variance
- Die / tooling (kerak bo‘lsa)
- Machine va jamoa

Muhim: mahsulot dona hisobida va list hisobida alohida saqlansin. Masalan, 1 list = 4 dona qadoq bo‘lsa, 500 list = 2 000 dona qadoq.

### 4.3 Kashirovka

Kashirovka ikki yoki undan ortiq materialni birlashtiradigan operatsiya sifatida modellashtirilsin.

Har bir input material alohida qayd etilsin:

- Printed sheet input
- Corrugated board / substrate input
- Glue yoki boshqa sarflanadigan materiallar (kerakli aniqlik darajasida)
- Good laminated output
- Recorded scrap
- Rework
- Remaining material A
- Remaining material B
- Unaccounted variance

Materiallar o‘lchov birliklari bir xil bo‘lishi shart emas. Har bir material uchun o‘z UOM va kerak bo‘lsa conversion rule saqlansin.

Kashirovka output'i yangi WIP mahsulot bo‘lib, keyingi operatsiyaga yuboriladi. Input materiallarning sarfi inventory ledger'da alohida qayd qilinsin.

### 4.4 Offset va boshqa operatsiyalar

Operation Type bo‘yicha konfiguratsiyalanadigan report template ishlatilsin. Har bir operatsiya uchun kerakli input/output UOM va maydonlar belgilanadi. Hamma operatsiyaga bitta majburiy forma qo‘llanmasin.

### 4.5 Final Packing

Packing Session alohida obyekt bo‘lsin.

Packing configuration quyidagilarni belgilaydi:

- Units per bundle
- Bundles per carton
- Cartons per pallet
- Ruxsat etilgan qisman bog‘lam/karton
- Packaging material sarfi

Operator yoki mas’ul xodim quyidagilarni qayd etadi:

- Packed quantity
- Bundle count
- Carton count
- Pallet count
- Partial package quantity
- Damaged / rejected quantity (agar mavjud bo‘lsa)
- Packing material consumption

Standart to‘liq bog‘lamlar uchun miqdorni avtomatik hisoblash mumkin. Lekin tizim real qadoqlangan miqdorni tasdiqlashni talab qilsin. Qisman bog‘lam yoki istisno holatlarda aniq miqdor kiritilsin.

Packing natijasida Finished Goods HU yaratiladi. Ular Finished Goods Inventory'ga qabul qilinadi.

## 5. Material reconciliation va yo‘qotishlar

Har bir operatsiyada quyidagi balans ko‘rsatilishi kerak:

Input = Good Output + Recorded Scrap + Rework + Remaining Material + Unaccounted Variance

Bu tenglama faqat bir xil o‘lchov birligidagi miqdorlar uchun ishlatilsin. Turli materiallar (masalan, bosma list va gofrokarton) alohida balansda hisoblanadi.

Muhim qoidalar:

- Unaccounted Variance avtomatik ravishda Scrap deb yozilmasin.
- Scrap qaydi operator yoki mas’ul shaxs tasdig‘i bilan kiritilsin.
- Material qoldig‘i keyingi operatsiyaga yoki omborga qaytarilishi mumkin bo‘lsin.
- Negative inventory yoki manfiy material balansi oddiy foydalanuvchi tomonidan yashirincha yaratilmasin.
- Farq belgilangan tolerancedan oshsa, supervisor review talab qilinsin.
- Tolerances material, operatsiya va o‘lchov birligi bo‘yicha sozlanadigan bo‘lsin.
- Tuzatishlar audit trail bilan saqlansin; oldingi yozuvni izsiz o‘chirishga yo‘l qo‘yilmasin.

### 5.1 Chiqindi yig‘ish

Fizik chiqindi qutisi yoki konteynerini Scrap Container sifatida ro‘yxatga olish mumkin.

- Konteynerga tegishli buyurtma yoki operatsiya belgilanadi.
- Chiqindi davriy ravishda sanaladi yoki tortiladi.
- Vazndan donaga konversiya faqat kalibrlangan norma mavjud bo‘lsa ishlatiladi.
- Taxminiy miqdor alohida “estimated” sifatida ko‘rsatilsin.
- Chiqindi aralashib ketgan va buyurtma bo‘yicha ajratib bo‘lmaydigan bo‘lsa, uni aniq buyurtmaga asossiz taqsimlamaslik kerak.

## 6. WIP Transfer — operatsiyalar orasidagi topshirish

WIP Transfer ikki bosqichli bo‘lsin:

1. Dispatch: yuboruvchi HU va miqdorni tanlaydi, qayerga yuborilishini belgilaydi.
2. Receipt: qabul qiluvchi haqiqiy qabul qilingan HU va miqdorni tasdiqlaydi.

Holatlar:

- Draft
- Dispatched
- Partially Received
- Received
- Discrepancy
- Cancelled

Transfer yuborilishi mahsulot qabul qilindi degani emas. Qabul qiluvchi tasdig‘i alohida bo‘lsin.

Qabul miqdori yuborilgan miqdordan farq qilsa, discrepancy yaratiladi va sabab kiritiladi.

## 7. Bitta kompyuter uchun UI/UX

Birinchi versiyada quyidagi ekranlar yetarli:

### 7.1 Production Dashboard

- Active production orders
- Delayed orders
- Operations in progress
- QC hold
- WIP by work center
- Unaccounted variances
- Today's completed operations

### 7.2 Production Board

Kanban yoki jadval ko‘rinishi:

- Ready
- In Progress
- Partially Completed
- Waiting for Transfer
- QC Hold
- Completed

### 7.3 Operation Detail

- Buyurtma va operatsiya ma’lumotlari
- Input HU'lar
- Operator/team
- Production report form
- Scrap va variance
- Transfer
- Audit history

### 7.4 Packing Screen

- Packing configuration
- Packed bundles/cartons/pallets
- Partial package entry
- Finished Goods HU creation

### 7.5 WIP Inventory

Qayerda qancha material borligini ko‘rsatadi:

- Work Center
- Location
- HU ID
- Production Order
- Operation status
- Quantity and UOM

Interfeys imkon qadar kam maydonli va tez ishlaydigan bo‘lsin. Default qiymatlar va standart bog‘lam miqdorlaridan foydalanilsin. Operatorning har bir harakatini alohida kiritish shart bo‘lmasin.

## 8. Rollar va ruxsatlar

- Production Planner / Dispatcher: rejalashtirish, operatsiyalarni yaratish, transferlarni kuzatish.
- Supervisor: operatsiyalarni tasdiqlash, variance review, correction approval.
- Operator: o‘z operatsiyasi bo‘yicha natijalarni kiritish (agar tizimga kirish imkoniyati bo‘lsa).
- Warehouse: material issue, WIP receipt, finished goods receipt.
- QC: sifat tekshiruvi, hold/release, scrap disposition.
- Admin: konfiguratsiya va ruxsatlar.

Kichik korxonada bitta xodim bir nechta rolga ega bo‘lishi mumkin. Lekin har bir harakatning haqiqiy foydalanuvchisi audit trail'da saqlansin.

## 9. Audit va ma’lumotlar yaxlitligi

Har bir muhim harakat quyidagilarni saqlasin:

- Kim kiritdi
- Qachon kiritdi
- Qaysi yozuv o‘zgardi
- Oldingi va yangi qiymat
- O‘zgarish sababi
- Tasdiqlagan shaxs (kerak bo‘lsa)

Completed operation'ni to‘g‘ridan-to‘g‘ri o‘zgartirish o‘rniga correction/reversal mexanizmi ishlatilsin.

## 10. Hisobotlar

Kamida quyidagi hisobotlar bo‘lsin:

1. Production Order progress
2. Operation performance
3. Work Center workload
4. WIP by location / operation
5. Material consumption
6. Scrap and waste
7. Unaccounted variance
8. Rework
9. Finished goods packing
10. Production lead time
11. Operator/team time (agar vaqt hisobga olinadigan bo‘lsa)

Hisobotlarda rejalashtirilgan va real miqdorlar farqlansin.

## 11. Tavsiya etilgan ma’lumotlar modeli

Quyidagi entity'lar yoki ularga teng jadvallarni loyihalash:

- sales_orders
- production_orders
- production_batches
- routing_templates
- routing_steps
- work_centers
- machines
- operation_batches
- operation_team_members
- handling_units
- handling_unit_contents
- handling_unit_movements
- operation_inputs
- operation_reports
- operation_output_lots
- scrap_records
- material_consumptions
- wip_transfers
- wip_transfer_lines
- packing_sessions
- packing_configurations
- inventory_transactions
- quality_inspections
- audit_logs

Bu ro‘yxat boshlang‘ich model. Mavjud ERP arxitekturasini tekshirmasdan aynan shu nomlar bilan jadvallarni ko‘r-ko‘rona yaratmaslik kerak. Avval mavjud modullar va entity'lar bilan moslashtirish talab qilinadi.

## 12. Muhim biznes qoidalari

1. Sales Order va Production Order bir xil narsa emas.
2. Operation Batch — buyurtmaning ma’lum operatsiyadagi bajarilishi.
3. Bir Operation Batch'da bir nechta operator bo‘lishi mumkin.
4. Operatorlar soni output miqdorini ko‘paytirmaydi.
5. Bitta HU bir nechta HU'ga bo‘linishi va bir nechta HU birlashtirilishi mumkin.
6. HU'ning parent-child tarixi saqlanadi.
7. Har bir operatsiya uchun input va output o‘lchov birliklari aniq belgilanadi.
8. Bir listdan bir nechta mahsulot chiqsa, conversion factor saqlanadi.
9. Kashirovkada har bir input material alohida hisoblanadi.
10. Brak, rework, qoldiq va variance alohida hisoblanadi.
11. Unaccounted variance hech qachon avtomatik ravishda brak deb belgilanmaydi.
12. Transfer yuborilishi qabul qilinish bilan teng emas.
13. Packing'da to‘liq va qisman bog‘lam/karton qo‘llab-quvvatlanadi.
14. Finished Goods Inventory faqat tasdiqlangan qadoqlash/qabul qilish jarayonidan so‘ng oshadi.
15. Har qanday correction audit trail bilan saqlanadi.

## 13. Amalga oshirish bosqichlari

### Phase 1 — Minimal ishlaydigan ishlab chiqarish nazorati

- Production Order
- Routing
- Work Center
- Operation Batch
- Bir nechta operatorni biriktirish
- Operation Report
- Good / Scrap / Variance
- Production Job Card chop etish
- Bitta kompyuter uchun Production Dashboard

### Phase 2 — Fizik material kuzatuvi

- Handling Unit
- Pallet/bundle/carton yorliqlari
- HU split/merge
- WIP Inventory
- WIP Transfer dispatch/receipt
- Material reconciliation
- Audit trail

### Phase 3 — Operatsiyaga xos hisob

- Die-cutting report
- Kashirovka multi-material consumption
- Packing Session
- Bundle/carton/pallet conversion
- Finished Goods receipt
- QC va rework

### Phase 4 — Qo‘shimcha avtomatlashtirish

- QR/barcode scanning
- Umumiy planshet yoki mobil interfeys
- Machine/work-center performance
- Advanced scheduling
- Scrap weighing va calibrated conversion
- Operator time tracking

## 14. Qabul qilish mezonlari (Acceptance Criteria)

Ishlab chiqilgan modul quyidagi testlardan o‘tishi shart:

1. 10 000 listli buyurtma 20 ta 500 listli bog‘lamga ajratilsin.
2. Bitta operatsiyada 3 operator birgalikda ishlasin, output uch marta sanalmasin.
3. 2 500 listli pallet 1 500 va 1 000 listli ikkita HU'ga bo‘linsin.
4. Ikki HU birlashtirilib yangi HU yaratilganda genealogy saqlansin.
5. Kashirovkada bosma list va gofrokarton sarfi alohida yuritilsin.
6. Input 10 000, good 9 600, recorded scrap 200 bo‘lsa, variance 200 bo‘lib ko‘rsatilsin.
7. 200 variance avtomatik scrap bo‘lmasin.
8. WIP transfer dispatch qilinganda qabul qiluvchi tasdiqlamaguncha received status bo‘lmasin.
9. Packing'da 100 dona/bog‘lam va 10 bog‘lam/karton sozlamasi bo‘lsin.
10. 95 dona qisman bog‘lam kiritilishi mumkin bo‘lsin.
11. Qadoqlangan mahsulot Finished Goods Inventory'ga faqat tasdiqlangan receipt orqali o‘tsin.
12. Har bir miqdor UOM bilan saqlansin.
13. Completed report tuzatilganda audit trail saqlansin.
14. Foydalanuvchi bitta markaziy kompyuterdan barcha jarayonlarni boshqara olsin.

## 15. Coding Agent uchun ish tartibi

Kod yozishni boshlashdan oldin:

1. Mavjud ERP repository va arxitekturani o‘rgan.
2. Mavjud Sales, Inventory, Warehouse, HR va Production entity'larini aniqlab ol.
3. Takroriy jadvallar yoki modullar yaratma.
4. Yuqoridagi biznes jarayonlarini mavjud arxitekturaga moslashtir.
5. Entity relationship diagram (ERD) va process flow tayyorla.
6. Data model, API, permissions va UI rejasini yoz.
7. Rejani tekshirtir va tasdiqlangandan keyin bosqichma-bosqich implementatsiya qil.
8. Har bir phase uchun migration, validation, test va hujjat tayyorla.
9. Realistic test data bilan acceptance criteria'ni tekshir.
10. Mavjud modullarning ishlashini buzma.

### Yakuniy talab

Tizimning maqsadi operatorlarga ko‘proq forma to‘ldirtirish emas. Maqsad — fizik ishlab chiqarishdagi material, yarim tayyor mahsulot, tayyor mahsulot va yo‘qotishlarni imkon qadar kam qo‘l mehnati bilan ishonchli hisobga olish.

Agar aniq miqdorni fizik jihatdan o‘lchash yoki sanash imkoni bo‘lmasa, tizim taxminni aniq fakt sifatida ko‘rsatmasin. Bunday holatda estimated value va unaccounted variance alohida ko‘rsatilsin.
