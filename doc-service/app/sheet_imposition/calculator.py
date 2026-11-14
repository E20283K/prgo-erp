"""
Layout & Grid Calculator: Montaj sig'imini, katakchalar koordinatalarini
hamda To'plam (Ganged Run / Multi-Design) tiraj va formalarini hisoblash
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from .models import (
    SheetConfig,
    BleedAndGutterConfig,
    PlacedItem,
    ImpositionMode,
    JobMetadata,
    DesignVariant,
    FormSlotAllocation,
    FormPlan,
    GangingStrategy,
    GridFillDirection,
    SheetAlignment,
)

MM_TO_PT = 72.0 / 25.4
PT_TO_MM = 25.4 / 72.0


class LayoutCalculator:
    """Montaj qog'oziga mahsulotlarni optimal joylashtiruvchi va formalarga taqsimlovchi hisoblagich."""

    @staticmethod
    def calculate_optimal_grid(
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        allow_rotation: bool = True
    ) -> Dict[str, Any]:
        """Qog'ozga eng ko'p mahsulot sig'adigan variantni (0° yoki 90°) hisoblaydi."""
        usable_w_mm = sheet.width_mm - sheet.margin_left_mm - sheet.margin_right_mm
        usable_h_mm = sheet.height_mm - sheet.margin_top_mm - sheet.margin_bottom_mm

        tw = bg_config.trim_width_mm
        th = bg_config.trim_height_mm
        gx = bg_config.gutter_x_mm
        gy = bg_config.gutter_y_mm

        # 1. 0 gradus (oddiy holat)
        cols_0 = max(1, int((usable_w_mm + gx) // (tw + gx))) if (tw + gx) > 0 else 1
        rows_0 = max(1, int((usable_h_mm + gy) // (th + gy))) if (th + gy) > 0 else 1
        total_0 = cols_0 * rows_0

        # 2. 90 gradus (burilgan holat)
        cols_90 = max(1, int((usable_w_mm + gx) // (th + gx))) if (th + gx) > 0 else 1
        rows_90 = max(1, int((usable_h_mm + gy) // (tw + gy))) if (tw + gy) > 0 else 1
        total_90 = cols_90 * rows_90

        if allow_rotation and total_90 > total_0:
            return {
                "rotation": 90,
                "cols": cols_90,
                "rows": rows_90,
                "total": total_90,
                "item_w_mm": th,
                "item_h_mm": tw,
            }
        else:
            return {
                "rotation": 0,
                "cols": cols_0,
                "rows": rows_0,
                "total": total_0,
                "item_w_mm": tw,
                "item_h_mm": th,
            }

    @staticmethod
    def calculate_sheets_needed(order_qty: int, items_per_sheet: int, waste_sheets: int = 0) -> int:
        """Bosilishi kerak bo'lgan listlar sonini hisoblash."""
        if items_per_sheet <= 0:
            return 0
        sheets = math.ceil(order_qty / items_per_sheet) + waste_sheets
        return sheets

    # -------------------------------------------------------------------------
    # AQLLI TO'PLAM VA FORMA OPTIMALLASHTIRGICH (GANGED RUN OPTIMIZER)
    # -------------------------------------------------------------------------

    @staticmethod
    def _allocate_slots_for_single_form(
        indexed_items: List[Tuple[int, DesignVariant, int]],
        items_per_sheet: int,
        waste_sheets: int = 0
    ) -> FormPlan:
        """
        Berilgan (variant_index, DesignVariant, target_qty) ro'yxatini bitta formaning
        `items_per_sheet` ta katagiga eng kam list tiraji (min-max sheet_run) va eng kam
        ortiqcha chiqindi beradigan qilib taqsimlaydi.
        """
        n = len(indexed_items)
        if n == 0 or items_per_sheet <= 0:
            return FormPlan(1, 1, 0, 0, [])

        slots = [0] * n
        fixed = [False] * n

        # 1. Qo'lda berilgan kataklarni (agar manual_slots bo'lsa) inobatga olish
        used = 0
        for i, (_, var, _) in enumerate(indexed_items):
            if var.manual_slots and var.assigned_slots > 0:
                s = min(var.assigned_slots, max(1, items_per_sheet - used - (n - 1 - i)))
                slots[i] = max(1, s)
                fixed[i] = True
                used += slots[i]
            else:
                slots[i] = 1
                used += 1

        # 2. Bo'sh qolgan kataklarni eng ko'p list talab qilayotgan (bottleneck) turga berish.
        # Eslatma: Asosiy zarur kataklar (base_slots) sheet_run ni kamaytirish uchun xizmat qiladi;
        # sheet_run endi kamaymaydigan nuqtadan keyin berilgan kataklar qog'oz sarfini oshirmaydigan "bonus" kataklardir.
        remaining = items_per_sheet - sum(slots)
        base_slots = list(slots)

        while remaining > 0:
            # Hozirgi maksimal sheet_run
            curr_max_run = max((math.ceil(q / slots[i]) for i, (_, _, q) in enumerate(indexed_items) if slots[i] > 0), default=0)

            best_i = -1
            best_key = (-1.0, -1.0, -1)
            for i, (_, _, q) in enumerate(indexed_items):
                if fixed[i]:
                    continue
                curr_run = math.ceil(q / slots[i]) if q > 0 else 0
                exact_ratio = q / slots[i]
                key = (float(curr_run), exact_ratio, q)
                if key > best_key:
                    best_key = key
                    best_i = i
            if best_i == -1:
                best_i = max(range(n), key=lambda idx: indexed_items[idx][2])
            slots[best_i] += 1
            remaining -= 1

            new_max_run = max((math.ceil(q / slots[i]) for i, (_, _, q) in enumerate(indexed_items) if slots[i] > 0), default=0)
            if new_max_run < curr_max_run:
                # Sheet run haqiqatan kamaydi -> base_slots ni yangilaymiz
                base_slots = list(slots)

        # 3. Shu forma uchun kerakli toza list sonini (sheet_run) hisoblash
        sheet_run = 0
        for i, (_, _, q) in enumerate(indexed_items):
            if base_slots[i] > 0 and q > 0:
                req = math.ceil(q / base_slots[i])
                if req > sheet_run:
                    sheet_run = req

        allocations: List[FormSlotAllocation] = []
        for i, (v_idx, var, q) in enumerate(indexed_items):
            prod = slots[i] * sheet_run
            # Haqiqiy texnologik perepechatka asosiy (base_slots) bo'yicha hisoblanadi
            # (chunki bo'sh kataklarni bonus sifatida to'ldirish 1 dona ham ortiqcha qog'oz listi sarflamaydi)
            base_prod = base_slots[i] * sheet_run
            over = max(0, base_prod - q)
            allocations.append(FormSlotAllocation(
                variant=var,
                variant_index=v_idx,
                slots=slots[i],
                target_qty=q,
                produced_qty=prod,
                overprint_qty=over
            ))

        return FormPlan(
            form_index=1,
            total_forms=1,
            sheet_run=sheet_run,
            total_sheets_with_waste=sheet_run + waste_sheets,
            allocations=allocations
        )

    @staticmethod
    def _find_exact_or_low_waste_subset(
        pool: List[Tuple[int, DesignVariant, int]],
        items_per_sheet: int,
        max_overprint_pct: float
    ) -> Optional[Tuple[int, List[Tuple[int, int]]]]:
        """
        Pool ichidan bitta formaning `items_per_sheet` ta katagini 0% (yoki ruxsat etilgan %)
        ortiqcha chiqindi bilan to'ldiradigan bazaviy tiraj `R` va `(pool_idx, slots)` to'plamini izlaydi.
        """
        if not pool:
            return None

        # Nomzod bazaviy list tirajlari R: har bir turning q // k qiymatlari
        candidate_runs = set()
        for _, _, q in pool:
            if q > 0:
                for k in range(1, min(items_per_sheet, 12) + 1):
                    if q % k == 0:
                        candidate_runs.add(q // k)
                    candidate_runs.add(math.ceil(q / k))

        best_solution = None  # (waste_ratio, -distinct_items, R, chosen_list)

        for R in sorted(candidate_runs):
            if R <= 0:
                continue
            # Shu R list tirajida qaysi turlar ruxsat etilgan overprint ichiga tushadi?
            valid_items = []
            for p_idx, (_, var, q) in enumerate(pool):
                s = max(1, math.ceil(q / R))
                if s > items_per_sheet:
                    continue
                over_pct = ((s * R - q) / q * 100.0) if q > 0 else 0.0
                if over_pct <= max_overprint_pct + 1e-6:
                    valid_items.append((p_idx, s, q, s * R - q))

            if not valid_items:
                continue

            # Bir nechta saralash tartibida DP yuritib, eng yaxshi qoldiq (lookahead) beradigan subsetni topamiz
            sort_orders = [
                lambda x: (x[3], -(x[1] % 2), -x[1], -x[2]),  # Toq kataklilar (3x, 1x) birinchi
                lambda x: (x[3], -x[1], -x[2]),               # Eng katta kataklilar birinchi
                lambda x: (x[3], x[1], x[2]),                 # Kichik kataklilar birinchi
            ]

            for sort_fn in sort_orders:
                ordered_items = sorted(valid_items, key=sort_fn)
                dp: Dict[int, Tuple[int, List[Tuple[int, int]]]] = {0: (0, [])}
                for p_idx, s, q, over_q in ordered_items:
                    next_dp = dict(dp)
                    for curr_s, (curr_over, curr_list) in dp.items():
                        new_s = curr_s + s
                        if new_s <= items_per_sheet:
                            new_over = curr_over + over_q
                            if new_s not in next_dp or new_over < next_dp[new_s][0]:
                                next_dp[new_s] = (new_over, curr_list + [(p_idx, s)])
                    dp = next_dp

                if items_per_sheet in dp:
                    tot_over, chosen = dp[items_per_sheet]
                    if len(pool) > 1 and len(chosen) == 1:
                        continue
                    tot_target = sum(pool[p_i][2] for p_i, _ in chosen)
                    waste_ratio = tot_over / max(1, tot_target)

                    # Lookahead: qolgan turlar (rem_pool) 1 ta formaga toza joylashadimi?
                    chosen_set = {p_i for p_i, _ in chosen}
                    rem_pool = [item for idx, item in enumerate(pool) if idx not in chosen_set]
                    rem_penalty = 0.0
                    if 0 < len(rem_pool) <= items_per_sheet:
                        rem_plan = LayoutCalculator._allocate_slots_for_single_form(rem_pool, items_per_sheet, 0)
                        rem_max_over = max((a.overprint_pct for a in rem_plan.allocations), default=0.0)
                        if rem_max_over > max_overprint_pct + 1e-6:
                            rem_penalty = 100.0 + rem_max_over
                        else:
                            rem_penalty = rem_max_over * 0.01

                    cand_key = (round(waste_ratio * 100.0 + rem_penalty, 4), -len(chosen), -tot_target, R)
                    if best_solution is None or cand_key < best_solution[0]:
                        best_solution = (cand_key, R, chosen)

        if best_solution is not None:
            return best_solution[1], best_solution[2]
        return None

    @staticmethod
    def optimize_ganged_forms(
        variants: List[DesignVariant],
        items_per_sheet: int,
        strategy: GangingStrategy = GangingStrategy.SMART_NO_SPLIT,
        max_overprint_pct: float = 10.0,
        waste_sheets: int = 0
    ) -> List[FormPlan]:
        """
        To'plamdagi turlarni (DesignVariant) ularning tirajiga qarab 1 yoki bir nechta
        FormPlan (Forma 1, Forma 2...) ga optimal taqsimlaydi.
        """
        if not variants or items_per_sheet <= 0:
            return []

        indexed_all = [(i, v, max(1, v.order_quantity)) for i, v in enumerate(variants)]

        # ---------------------------------------------------------------------
        # 1. Qo'lda katak sonlari berilgan bo'lsa yoki SINGLE_FORM_PROPORTIONAL
        # ---------------------------------------------------------------------
        has_manual = any(v.manual_slots and v.assigned_slots > 0 for v in variants)
        if strategy == GangingStrategy.MANUAL_SLOTS or has_manual:
            # Agar jami kataklar 1 ta listga sig'sa
            total_manual = sum((v.assigned_slots if v.manual_slots and v.assigned_slots > 0 else 1) for v in variants)
            if total_manual <= items_per_sheet:
                plan = LayoutCalculator._allocate_slots_for_single_form(indexed_all, items_per_sheet, waste_sheets)
                return [plan]

        if strategy == GangingStrategy.SINGLE_FORM_PROPORTIONAL and len(variants) <= items_per_sheet:
            plan = LayoutCalculator._allocate_slots_for_single_form(indexed_all, items_per_sheet, waste_sheets)
            return [plan]

        # ---------------------------------------------------------------------
        # 2. Avval 1 ta Formaga sig'ish-sig'masligini tekshiramiz (barcha strategiyalarda)
        # ---------------------------------------------------------------------
        if len(variants) <= items_per_sheet:
            single_plan = LayoutCalculator._allocate_slots_for_single_form(indexed_all, items_per_sheet, waste_sheets)
            max_var_over_pct = max((a.overprint_pct for a in single_plan.allocations), default=0.0)
            if max_var_over_pct <= max_overprint_pct + 1e-6:
                return [single_plan]

        # ---------------------------------------------------------------------
        # 3. MAX_ECONOMY_SPLIT (Turni formalar orasida bo'lishga ruxsat)
        # ---------------------------------------------------------------------
        if strategy == GangingStrategy.MAX_ECONOMY_SPLIT:
            rem_pool = [[i, v, max(1, v.order_quantity)] for i, v in enumerate(variants)]
            forms: List[FormPlan] = []

            while rem_pool:
                # a) Qolgan turlar 1 ta formaga ruxsat etilgan overprint bilan sig'adimi?
                if len(rem_pool) <= items_per_sheet:
                    cand_plan = LayoutCalculator._allocate_slots_for_single_form(
                        [(x[0], x[1], x[2]) for x in rem_pool], items_per_sheet, waste_sheets
                    )
                    max_over = max((a.overprint_pct for a in cand_plan.allocations), default=0.0)
                    if max_over <= max_overprint_pct + 1e-6:
                        forms.append(cand_plan)
                        break

                # b) Eng katta bazaviy list tiraji R ni topamizki, to'liq kataklar yig'indisi >= items_per_sheet bo'lsin
                # Nomzod R lar: q // k
                cand_runs = set()
                for _, _, q in rem_pool:
                    for k in range(1, items_per_sheet + 1):
                        if q // k > 0:
                            cand_runs.add(q // k)
                sorted_runs = sorted(cand_runs, reverse=True)

                chosen_R = None
                for R in sorted_runs:
                    full_slots = sum(q // R for _, _, q in rem_pool)
                    if full_slots >= items_per_sheet:
                        chosen_R = R
                        break

                if chosen_R is not None and chosen_R > 0:
                    # chosen_R tirajli forma yaratamiz va eng ko'p qoldiqli turlardan items_per_sheet ta katak olamiz
                    # Avval har bir turdan q // chosen_R tagacha katak ajratamiz
                    avail = []
                    for p_idx, (v_idx, var, q) in enumerate(rem_pool):
                        s_full = q // chosen_R
                        if s_full > 0:
                            avail.append([p_idx, v_idx, var, s_full, q])
                    # Katta tirajlilarni birinchi olamiz
                    avail.sort(key=lambda x: (-x[4], x[1]))

                    slots_Left = items_per_sheet
                    allocs: List[FormSlotAllocation] = []
                    for p_idx, v_idx, var, s_full, q in avail:
                        if slots_Left <= 0:
                            break
                        take_s = min(s_full, slots_Left)
                        prod_q = take_s * chosen_R
                        allocs.append(FormSlotAllocation(
                            variant=var,
                            variant_index=v_idx,
                            slots=take_s,
                            target_qty=prod_q,
                            produced_qty=prod_q,
                            overprint_qty=0
                        ))
                        rem_pool[p_idx][2] -= prod_q
                        slots_Left -= take_s

                    # Tartibni variant_index bo'yicha tiklaymiz
                    allocs.sort(key=lambda a: a.variant_index)
                    forms.append(FormPlan(
                        form_index=len(forms) + 1,
                        total_forms=0,
                        sheet_run=chosen_R,
                        total_sheets_with_waste=chosen_R + waste_sheets,
                        allocations=allocs
                    ))
                    rem_pool = [x for x in rem_pool if x[2] > 0]
                else:
                    # Agar to'liq bo'linadigan R topilmasa, eng yaqin items_per_sheet ta turni bitta formaga olamiz
                    rem_pool.sort(key=lambda x: (-x[2], x[0]))
                    chunk = rem_pool[:items_per_sheet]
                    rem_pool = rem_pool[items_per_sheet:]
                    plan = LayoutCalculator._allocate_slots_for_single_form(
                        [(x[0], x[1], x[2]) for x in chunk], items_per_sheet, waste_sheets
                    )
                    forms.append(plan)

            for idx, fp in enumerate(forms):
                fp.form_index = idx + 1
                fp.total_forms = len(forms)
            return forms

        # ---------------------------------------------------------------------
        # 4. SMART_NO_SPLIT (Har bir tur faqat 1 ta formada: Kratnost + Klasterlash)
        # ---------------------------------------------------------------------
        pool = list(indexed_all)
        forms_no_split: List[FormPlan] = []

        while pool:
            # a) Agar qolgan barcha turlar 1 ta formaga ruxsat etilgan overprint bilan sig'sa
            if len(pool) <= items_per_sheet:
                cand_plan = LayoutCalculator._allocate_slots_for_single_form(pool, items_per_sheet, waste_sheets)
                max_over = max((a.overprint_pct for a in cand_plan.allocations), default=0.0)
                if max_over <= max_overprint_pct + 1e-6:
                    forms_no_split.append(cand_plan)
                    break

            # b) Pool ichidan aniq items_per_sheet ta katakni minimal chiqindi bilan to'ldiruvchi subset izlaymiz
            exact_match = LayoutCalculator._find_exact_or_low_waste_subset(pool, items_per_sheet, max_overprint_pct)
            if exact_match is not None:
                R, chosen_pairs = exact_match
                chosen_indices = {p_i for p_i, _ in chosen_pairs}
                chosen_subset = [pool[p_i] for p_i, _ in chosen_pairs]
                # _allocate_slots_for_single_form orqali yanada optimallashtiramiz
                plan = LayoutCalculator._allocate_slots_for_single_form(chosen_subset, items_per_sheet, waste_sheets)
                plan.allocations.sort(key=lambda a: a.variant_index)
                forms_no_split.append(plan)
                pool = [item for idx, item in enumerate(pool) if idx not in chosen_indices]
                continue

            # c) Agar to'liq subset topilmasa, yaqin tirajli turlarni guruhlaymiz
            pool_sorted = sorted(pool, key=lambda x: (-x[2], x[0]))
            # Birinchi turni olamiz va unga tiraji mos (karrali yoki yaqin) turlarni qo'shamiz
            seed = pool_sorted[0]
            group = [seed]
            used_v_indices = {seed[0]}

            for cand in pool_sorted[1:]:
                if len(group) >= items_per_sheet:
                    break
                test_group = group + [cand]
                test_plan = LayoutCalculator._allocate_slots_for_single_form(test_group, items_per_sheet, waste_sheets)
                max_over = max((a.overprint_pct for a in test_plan.allocations), default=0.0)
                if max_over <= max_overprint_pct + 1e-6:
                    group = test_group
                    used_v_indices.add(cand[0])

            # Agar guruhda faqat 1 ta element qolgan bo'lsa va pool da hali ko'p element bo'lsa,
            # lekin len(pool) > items_per_sheet sababli sig'mayotgan bo'lsa:
            if len(group) == 1 and len(pool_sorted) > 1:
                # Eng kam overprint beradigan qo'shnilarni qo'shamiz
                for cand in pool_sorted[1:]:
                    if len(group) >= items_per_sheet:
                        break
                    test_group = group + [cand]
                    test_plan = LayoutCalculator._allocate_slots_for_single_form(test_group, items_per_sheet, waste_sheets)
                    max_over = max((a.overprint_pct for a in test_plan.allocations), default=0.0)
                    if max_over <= max(25.0, max_overprint_pct * 2.0):
                        group = test_group
                        used_v_indices.add(cand[0])

            plan = LayoutCalculator._allocate_slots_for_single_form(group, items_per_sheet, waste_sheets)
            plan.allocations.sort(key=lambda a: a.variant_index)
            forms_no_split.append(plan)
            pool = [item for item in pool if item[0] not in used_v_indices]

        for idx, fp in enumerate(forms_no_split):
            fp.form_index = idx + 1
            fp.total_forms = len(forms_no_split)

        return forms_no_split

    # -------------------------------------------------------------------------
    # QOLIP KOORDINATALARI VA KATTAKLARNI JOYLASHTIRISH (GRID LAYOUT)
    # -------------------------------------------------------------------------

    @staticmethod
    def generate_layout(
        sheet: SheetConfig,
        bg_config: BleedAndGutterConfig,
        cols: int,
        rows: int,
        rotation: int = 0,
        mode: ImpositionMode = ImpositionMode.SINGLE_SIDED,
        center_grid: bool = True,
        fill_direction: GridFillDirection = GridFillDirection.COL_BY_COL,
        form_plan: Optional[FormPlan] = None
    ) -> Tuple[List[PlacedItem], Optional[List[PlacedItem]]]:
        """
        Oldi (Front) va kerak bo'lsa Orqa (Back) sahifalar uchun PlacedItem ro'yxatini qaytaradi.
        Agar `form_plan` berilsa, har bir katakka tegishli `variant_index` va `variant_name` biriktiriladi
        hamda Orqa sahifada (Sheetwise) gorizontal oyna aksida aynan o'sha turning Orqasi tushishi kafolatlanadi.
        """
        sheet_w_pt = sheet.width_pt
        sheet_h_pt = sheet.height_pt

        # Burilishga qarab katakcha toza o'lchami
        if rotation in (90, 270):
            cell_w_pt = bg_config.trim_height_pt
            cell_h_pt = bg_config.trim_width_pt
        else:
            cell_w_pt = bg_config.trim_width_pt
            cell_h_pt = bg_config.trim_height_pt

        gx_pt = bg_config.gutter_x_pt
        gy_pt = bg_config.gutter_y_pt

        # Umumiy blok o'lchami
        total_grid_w = cols * cell_w_pt + max(0, cols - 1) * gx_pt
        total_grid_h = rows * cell_h_pt + max(0, rows - 1) * gy_pt

        # Boshlang'ich koordinatalar
        margin_left_pt = sheet.margin_left_mm * MM_TO_PT
        margin_right_pt = sheet.margin_right_mm * MM_TO_PT
        margin_bottom_pt = sheet.margin_bottom_mm * MM_TO_PT  # Klapan
        margin_top_pt = sheet.margin_top_mm * MM_TO_PT

        usable_w_pt = sheet_w_pt - margin_left_pt - margin_right_pt
        usable_h_pt = sheet_h_pt - margin_top_pt - margin_bottom_pt

        # Top-Down koordinata (PyMuPDF standartida: Y=0 yuqorida, Y=height pastda)
        if getattr(bg_config, "alignment", None) == SheetAlignment.CENTER:
            # Butun list markazi bo'yicha to'liq simmetrik joylashtirish (oldi-orqa mukammal mos tushishi uchun)
            start_x = max(0.0, (sheet_w_pt - total_grid_w) / 2.0)
            start_y = max(0.0, (sheet_h_pt - total_grid_h) / 2.0)
        elif center_grid:
            start_x = margin_left_pt + max(0.0, (usable_w_pt - total_grid_w) / 2.0)
            start_y = margin_top_pt + max(0.0, (usable_h_pt - total_grid_h) / 2.0)
        else:
            start_x = margin_left_pt
            start_y = margin_top_pt

        # Har bir katak uchun (variant_index, variant_name) ketma-ketligini tayyorlash
        total_cells = cols * rows
        slot_assignments: List[Tuple[int, str]] = []
        if form_plan and form_plan.allocations:
            for alloc in form_plan.allocations:
                for _ in range(max(0, alloc.slots)):
                    slot_assignments.append((alloc.variant_index, alloc.variant.name))
            # Agar kataklar soni total_cells dan kam bo'lsa, oxirgi turni takrorlab to'ldiramiz
            while len(slot_assignments) < total_cells and slot_assignments:
                slot_assignments.append(slot_assignments[-1])
        else:
            slot_assignments = [(0, "") for _ in range(total_cells)]

        # Kataklarni fill_direction bo'yicha (col, row) indeksiga bog'lash
        cell_variant_map: Dict[Tuple[int, int], Tuple[int, str]] = {}
        seq_idx = 0
        if fill_direction == GridFillDirection.COL_BY_COL:
            # Ustun bo'yicha: avval 0-ustun yuqoridan pastga, keyin 1-ustun...
            for c in range(cols):
                for r in range(rows):
                    cell_variant_map[(c, r)] = slot_assignments[min(seq_idx, len(slot_assignments) - 1)]
                    seq_idx += 1
        else:
            # Qator bo'yicha: avval 0-qator chapdan o'ngga, keyin 1-qator...
            for r in range(rows):
                for c in range(cols):
                    cell_variant_map[(c, r)] = slot_assignments[min(seq_idx, len(slot_assignments) - 1)]
                    seq_idx += 1

        front_items: List[PlacedItem] = []
        back_items: Optional[List[PlacedItem]] = [] if mode in (ImpositionMode.SHEETWISE, ImpositionMode.WORK_AND_TURN) else None

        # Oldi tomon katakchalarini yaratish (r=0 yuqori qator)
        for r in range(rows):
            y = start_y + r * (cell_h_pt + gy_pt)
            for c in range(cols):
                x = start_x + c * (cell_w_pt + gx_pt)
                v_idx, v_name = cell_variant_map.get((c, r), (0, ""))
                item = PlacedItem(
                    col=c,
                    row=r,
                    trim_x=x,
                    trim_y=y,
                    trim_w=cell_w_pt,
                    trim_h=cell_h_pt,
                    rotation=rotation,
                    is_back_side=False,
                    variant_index=v_idx,
                    variant_name=v_name
                )
                front_items.append(item)

        # Agar Orqa tomon (Sheetwise) bo'lsa:
        # Sheetwise rejimida qog'oz gorizontal (chapdan o'ngga) ag'dariladi.
        # Shunda oldi tomonning chap ustuni (c) orqa tomonning o'ng ustuniga (cols - 1 - c) to'g'ri keladi
        # va AYNAN O'SHA variant_index ning Orqa tomoni tushishi shart!
        if mode in (ImpositionMode.SHEETWISE, ImpositionMode.WORK_AND_TURN) and back_items is not None:
            for item in front_items:
                back_x = sheet_w_pt - (item.trim_x + item.trim_w)
                back_y = item.trim_y  # Klapan o'zgarmaydi

                back_item = PlacedItem(
                    col=cols - 1 - item.col,
                    row=item.row,
                    trim_x=back_x,
                    trim_y=back_y,
                    trim_w=item.trim_w,
                    trim_h=item.trim_h,
                    rotation=rotation,
                    is_back_side=True,
                    variant_index=item.variant_index,
                    variant_name=item.variant_name
                )
                back_items.append(back_item)

        return front_items, back_items
