# PrintGoo ERP — Poligrafiya va Qadoqlash Texnologik Reglamenti (Playbook)

Ushbu qo'llanma matbaa ishlab chiqarish muhandislari, texnologlar va hisobchilar tomonidan qabul qilingan hisob-kitob qoidalari, texnologik normalar va formulalarni o'z ichiga oladi.

---

## 1. Varaqli Ofset Bosma (Sheet-Fed Offset)

### A. Varaqdagi Joylashuv (Ups Calculation):
Mahsulot o'lchami: $W_p \times H_p$ (kesimdan keyingi o'lcham).
Bosma varaq o'lchami: $W_s \times H_s$ (masalan: $700 \times 1000$ mm yoki $520 \times 720$ mm).
Klavan (Gripper margin): 10-12 mm.
Kesim maydoni (Bleed & Trim): Har bir mahsulot atrofida kamida 2-3 mm kesim zaxirasi bo'lishi shart.
$$\text{Ups} = \max\left( \lfloor W_s / (W_p + 4) \rfloor \times \lfloor H_s / (H_p + 4) \rfloor, \lfloor W_s / (H_p + 4) \rfloor \times \lfloor H_s / (W_p + 4) \rfloor \right)$$

### B. Varaqlar Miqdori va Texnologik Isrof (Waste / Spoilage):
1. **Netto varaq:**
   $$\text{NetSheets} = \lceil \text{OrderQuantity} / \text{Ups} \rceil$$
2. **Priladka isrofi (Make-Ready Waste):**
   - Standart ofset uchun: Har bir CTP plastinaga (rangli seksiyaga) 50 varaq xomashyo ajratiladi.
   - Plastinalar soni = $\text{ColorsFront} + \text{ColorsBack} + (\text{Varnish} ? 1 : 0)$.
   - $\text{MakeReadySheets} = \text{PlatesCount} \times 50$.
3. **Tirajdagi texnologik isrof (Running Waste):**
   - Ofset bosmada barqaror tiraj isrofi o'rtacha 2.0% ni tashkil qiladi.
   - $\text{RunningWasteSheets} = \lceil \text{NetSheets} \times 0.02 \rceil$.
4. **Brutto (Jami zarur varaqlar):**
   $$\text{TotalGrossSheets} = \text{NetSheets} + \text{MakeReadySheets} + \text{RunningWasteSheets}$$

### C. Qog'oz Og'irligi va Narxi:
- Varaq yuzasi ($m^2$) = $(W_s \times H_s) / 1\,000\,000$.
- Qog'oz og'irligi (kg) = $\text{TotalGrossSheets} \times \text{SheetAreaM2} \times \text{GSM} / 1000$.
- Qog'oz qiymati ($USD$) = $\text{WeightKg} \times \text{PricePerKg}$.

---

## 2. Rulonli Fleksografiya (Roll-Fed Flexo)

### A. Silindr Tishlari va Takrorlanish (Repeat Length):
- Standart fleksografik tish qadami: $1 \text{ tooth} = 1/8 \text{ inch} = 3.175 \text{ mm}$.
- Takrorlanish uzunligi (Repeat length):
  $$\text{RepeatMm} = \text{CylinderTeeth (Z)} \times 3.175$$
- Oqimdagi takrorlanishlar soni = $\lceil \text{OrderQuantity} / \text{LabelsAcross} \rceil$.
- **Netto metr:** $\text{NetMeters} = (\text{RepeatsNeeded} \times \text{RepeatMm}) / 1000$.

### B. Flekso Priladka va Material Sarfi:
- **Priladka isrofi:** Har bir rangli seksiyaga (fotopolimer klishe) kamida 60 chiziqli metr xomashyo ajratiladi.
- $\text{MakeReadyMeters} = \text{ColorsCount} \times 60 \text{ m}$.
- **Tiraj isrofi:** Standart 2.5% rulon bo'ylab yo'qotish.
- **Jami brutto metr:** $\text{GrossMeters} = \text{NetMeters} + \text{MakeReadyMeters} + \lceil \text{NetMeters} \times 0.025 \rceil$.

---

## 3. Bosmadan Keyingi Ishlov (Post-Press)

| Jarayon | Parametrlar | Hisoblash Usuli |
|---|---|---|
| Laminatsiya | Mat / Yaltiroq / Soft-Touch, 1 yoki 2 tomonlama | Jami bosma varaqlar yuzasi ($m^2$) bo'yicha |
| Laklash | Ofset dispersiya lami, UF lak, Selektiv UF | Seksiyalar soni va bosma varaqlar tiraji bo'yicha |
| Shtamp / Qirqish (Die-Cutting) | Pichoq tayyorlash (Shtamp shakli) + zarblar soni | Bir martalik shtamp narxi + har 1,000 zarb uchun tarif |
| Buklash (Falts) | 1, 2, 3 buklash, evro-buklet | Varaqlar soni va buklashlar qatlamiga ko'ra |
| Yelimli mahkamlash (PUR / Hot-melt) | Katalog va kitob bloklari | Blok qalinligi va dona soni bo'yicha |

---

## 4. Xomashyo Turlari va Standart Zichliklar (GSM)

- **Bo'rli qog'oz (Coated / Melovannaya):** 90g, 115g, 130g, 150g, 170g, 200g, 250g, 300g (jurnal, buklet, katalog sahifalari).
- **Ofset qog'ozi (Woodfree uncoated):** 65g, 80g, 100g, 120g (kitob matnlari, blanklar, daftarlar).
- **Qadoqlash kartoni (FBB / GC1 / GC2):** 230g, 250g, 280g, 300g, 350g (farmatsevtika, oziq-ovqat va kosmetika qutilari).
- **O'ziyopishqoq rulonli material (Self-adhesive Fasson):** Yarimyaltiroq (Semi-Gloss), Polipropilen (PP White Gloss, PP Clear), Termo Eko / Termo Top.
