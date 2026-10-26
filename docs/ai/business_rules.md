# PrintGoo ERP — Korxona Biznes Qoidalari va Qarorlar Matritsasi

Ushbu hujjat korxonadagi moliyaviy, ishlab chiqarish va sotuv bo'yicha reglamentlarni o'z ichiga oladi.

---

## 1. Moliyaviy va Kredit Cheklovlari (Credit Control)

1. **Qarzdorlik bo'yicha bloklash:**
   - Agar mijozning muddati o'tgan debitorlik qarzi mavjud bo'lsa (`ClosingBalance > CreditLimit` yoki to'lov muddati 14 kundan oshgan bo'lsa), yangi buyurtmani ishlab chiqarishga kiritish taqiqlanadi (`Status: Draft` yoki `Stage: On Hold` holatida ushlanadi).
   - Istisno: Bosh direktor yoki Tijorat direktori maxsus ruxsati bilan `Urgent` belgisi qo'yilgan holatlar.
2. **Oldindan to'lov (Prepayment) me'yorlari:**
   - Yangi mijozlar uchun: 100% oldindan to'lov.
   - Doimiy (A-toifa) mijozlar uchun: 30% avans, 70% yuk ortilgandan so'ng 10 bank kuni ichida.

---

## 2. Ishlab Chiqarish Ustuvorligi (Priority Dispatching)

| Ustuvorlik | Rangi / Belgisi | Dastgohga Joylash Tartibi | Boshlanish Muddatlari |
|---|---|---|---|
| `Urgent` | Qizil | Barcha joriy navbatlarni surib, birinchi navbatda dastgohga o'rnatiladi | 24 soat ichida |
| `High` | To'q sariq | Rejalashtirilgan smena boshida o'rnatiladi | 48 soat ichida |
| `Normal` | Neytral / Moviy | Standart texnologik navbat (FIFO) bo'yicha | Standart reja grafigi |

---

## 3. Tirajning Haqiqiy Chiqishi va Ruxsat Etilgan Og'ish (Tolerances)

Matbaa sanoati xalqaro standartlariga muvofiq, tayyor mahsulot tirajida quyidagi og'ish me'yorlari ruxsat etiladi:
- Tiraj 1,000 tagacha bo'lsa: $\pm 7\%$
- Tiraj 1,000 dan 10,000 gacha bo'lsa: $\pm 5\%$
- Tiraj 10,000 dan yuqori bo'lsa: $\pm 3\%$
Ortiqcha bosilgan mahsulot mijoz roziligi bilan faktura qilinadi yoki bepul namuna sifatida topshiriladi.

---

## 4. Xavfsizlik Qoldiqlari va Ta'minot Chegaralari (Safety Stock)

- Asosiy qog'oz turlari (115g, 130g, 150g melovka) uchun minimal zaxira: kamida 3 smenalik uzluksiz bosmaga yetadigan hajm (kamida 5,000 varaq B1).
- CTP plastinalar (Heidelberg Suprasetter B1 / Komori) uchun minimal ombor qoldig'i: kamida 150 dona plastina.
- Agar erkin qoldiq (`FreeStock`) minimal chegaradan pastga tushsa, AI Copilot xarid buyurtmasini (Purchase Draft) shakllantirishni taklif qiladi.
