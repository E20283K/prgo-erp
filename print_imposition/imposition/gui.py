"""
Desktop GUI: Poligrafiya Vektorli Montaj (Imposition), To'plam (Ganged Run) va Preflight Dasturi
"""

import os
import sys
import time
import datetime
from typing import List, Optional
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import pymupdf
from PIL import Image, ImageTk

from imposition.models import (
    SheetConfig,
    BleedAndGutterConfig,
    JobMetadata,
    ImpositionMode,
    TemplateStyle,
    ColorChannel,
    PreflightReport,
    DesignVariant,
    FormPlan,
    GangingStrategy,
    GridFillDirection,
    JobCategory,
    GuillotineCutStyle,
    SheetAlignment,
)
from imposition.preflight import PreflightChecker
from imposition.calculator import LayoutCalculator
from imposition.engine import ImpositionEngine


class ImpositionApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Poligrafiya Vektorli Montaj (Imposition), To'plam & Preflight")
        self.root.geometry("1320x880")
        self.root.minsize(1080, 720)

        # Ish rejimi: 'single' (Yakka dizayn) yoki 'multi' (To'plam / Ganged)
        self.job_type_var = tk.StringVar(value="single")
        self.multi_page_mode_var = tk.StringVar(value="pages")  # 'pages' yoki 'alternating'
        self.variants: List[DesignVariant] = []
        self.last_form_plans: List[FormPlan] = []

        # Tahrirlash maydonlari (To'plam jadvali uchun)
        self.edit_var_name = tk.StringVar(value="")
        self.edit_var_qty = tk.IntVar(value=1000)
        self.edit_var_slots = tk.IntVar(value=0)

        # Optimallashtirish strategiyasi va perepechatka %
        self.ganging_strategy_var = tk.StringVar(value=GangingStrategy.SMART_NO_SPLIT.value)
        self.max_overprint_var = tk.DoubleVar(value=10.0)
        self.fill_dir_var = tk.StringVar(value=GridFillDirection.COL_BY_COL.value)

        # Holat o'zgaruvchilari (Yakka dizayn va Umumiy Orqa/Pichoq)
        self.front_pdf_path = tk.StringVar(value="")
        self.back_pdf_path = tk.StringVar(value="")
        self.dieline_pdf_path = tk.StringVar(value="")

        # Preflight hisoboti
        self.preflight_report: Optional[PreflightReport] = None

        # Asosiy Ish Toifasi: 'guillotine' (Oddiy kesim - Gilotin) yoki 'diecut' (Pichoqli ish)
        self.job_category_var = tk.StringVar(value=JobCategory.GUILLOTINE.value)
        self.sheet_alignment_var = tk.StringVar(value=SheetAlignment.CENTER.value)
        self.template_preset_var = tk.StringVar(value="offset")  # 'offset' yoki 'digital'

        # Montaj sozlamalari
        self.sheet_preset = tk.StringVar(value="500 x 350 mm")
        self.sheet_w_var = tk.DoubleVar(value=500.0)
        self.sheet_h_var = tk.DoubleVar(value=350.0)
        self.gripper_var = tk.DoubleVar(value=15.0)

        self.trim_w_var = tk.DoubleVar(value=90.0)
        self.trim_h_var = tk.DoubleVar(value=50.0)
        self.bleed_var = tk.DoubleVar(value=1.5)
        self.inner_bleed_var = tk.DoubleVar(value=1.5)
        self.outer_bleed_var = tk.DoubleVar(value=2.0)
        self.crop_gap_var = tk.DoubleVar(value=1.0)
        self.gutter_mode_var = tk.StringVar(value="double")  # 'double' (3mm), 'single' (0mm), 'custom', 'diecut'
        self.gutter_var = tk.DoubleVar(value=3.0)

        # Grid sozlamalari
        self.auto_grid_var = tk.BooleanVar(value=True)
        self.cols_var = tk.IntVar(value=4)
        self.rows_var = tk.IntVar(value=6)
        self.rotation_var = tk.IntVar(value=0)

        # Buyurtma ma'lumotlari
        self.order_num_var = tk.StringVar(value="№1045")
        self.job_name_var = tk.StringVar(value="Montaj_Buyurtma")
        self.order_qty_var = tk.IntVar(value=1000)
        self.waste_var = tk.IntVar(value=0)
        self.date_var = tk.StringVar(value=datetime.date.today().strftime("%d.%m.%Y"))
        self.calc_sheets_var = tk.StringVar(value="4 000 list")
        self.forms_summary_var = tk.StringVar(value="1 ta forma")

        # Shablon va Rejim
        self.mode_var = tk.StringVar(value=ImpositionMode.SINGLE_SIDED.value)
        self.style_var = tk.StringVar(value=TemplateStyle.OFFSET_STANDARD.value)
        self.export_separate_var = tk.BooleanVar(value=False)

        # Preview o'zgaruvchilari
        self.preview_doc: Optional[pymupdf.Document] = None
        self.current_preview_page = 0
        self.zoom_level = 1.0
        self.preview_image_tk = None
        self._is_updating = False

        self._setup_ui()
        self._bind_traces()
        self._on_sheet_preset_changed()

    def _setup_ui(self):
        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        left_frame = ttk.Frame(main_paned, width=510)
        main_paned.add(left_frame, weight=0)

        right_frame = ttk.Frame(main_paned)
        main_paned.add(right_frame, weight=1)

        notebook = ttk.Notebook(left_frame)
        notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        tab_files = ttk.Frame(notebook)
        tab_layout = ttk.Frame(notebook)
        tab_passport = ttk.Frame(notebook)

        notebook.add(tab_files, text="1. Fayllar & To'plam")
        notebook.add(tab_layout, text="2. Qog'oz & Joylashtirish")
        notebook.add(tab_passport, text="3. Pasport & Ranglar")

        self._build_tab_files(tab_files)
        self._build_tab_layout(tab_layout)
        self._build_tab_passport(tab_passport)

        action_box = ttk.LabelFrame(left_frame, text="Amallar", padding=10)
        action_box.pack(fill=tk.X, padx=5, pady=5)

        ttk.Checkbutton(
            action_box,
            text="Alohida fayllar qilib saqlash (oldi, orqa, pichoq / formalar)",
            variable=self.export_separate_var
        ).pack(anchor=tk.W, pady=3)

        btn_refresh_large = tk.Button(
            action_box,
            text="🔄 MONTAJNI YANGILASH (PREVIEW)",
            bg="#28a745",
            fg="white",
            activebackground="#218838",
            activeforeground="white",
            font=("Segoe UI", 10, "bold"),
            relief=tk.RAISED,
            pady=7,
            command=self.force_regenerate
        )
        btn_refresh_large.pack(fill=tk.X, pady=(2, 4))

        btn_run = tk.Button(
            action_box,
            text="🚀 MONTAJNI YARATISH VA PDF SAQLASH",
            bg="#007acc",
            fg="white",
            font=("Segoe UI", 10, "bold"),
            relief=tk.RAISED,
            pady=8,
            command=self.run_imposition_flow
        )
        btn_run.pack(fill=tk.X, pady=4)

        self._build_preview_panel(right_frame)

    def _bind_traces(self):
        """Barcha o'zgaruvchilarga kuzatuvchi (trace) qo'yib, preview va hisob-kitobni avtomatik yangilash."""
        self.front_pdf_path.trace_add("write", lambda *a: self._on_file_input_changed())
        self.back_pdf_path.trace_add("write", lambda *a: self._on_secondary_file_changed())
        self.dieline_pdf_path.trace_add("write", lambda *a: self._on_secondary_file_changed())

        self.job_category_var.trace_add("write", lambda *a: self._on_job_category_changed())
        self.sheet_alignment_var.trace_add("write", lambda *a: self._trigger_preview())
        self.gutter_mode_var.trace_add("write", lambda *a: self._on_gutter_mode_changed())
        self.sheet_preset.trace_add("write", lambda *a: self._on_sheet_preset_changed())
        self.trim_w_var.trace_add("write", lambda *a: self._recalculate_grid())
        self.trim_h_var.trace_add("write", lambda *a: self._recalculate_grid())
        self.sheet_w_var.trace_add("write", lambda *a: self._on_sheet_dim_changed())
        self.sheet_h_var.trace_add("write", lambda *a: self._on_sheet_dim_changed())
        self.gripper_var.trace_add("write", lambda *a: self._recalculate_grid())
        self.bleed_var.trace_add("write", lambda *a: self._trigger_preview())
        self.inner_bleed_var.trace_add("write", lambda *a: self._trigger_preview())
        self.outer_bleed_var.trace_add("write", lambda *a: self._trigger_preview())
        self.crop_gap_var.trace_add("write", lambda *a: self._trigger_preview())
        self.gutter_var.trace_add("write", lambda *a: self._recalculate_grid())

        self.cols_var.trace_add("write", lambda *a: self._on_grid_param_changed())
        self.rows_var.trace_add("write", lambda *a: self._on_grid_param_changed())
        self.rotation_var.trace_add("write", lambda *a: self._trigger_preview())

        self.mode_var.trace_add("write", lambda *a: self._trigger_preview())
        self.style_var.trace_add("write", lambda *a: self._on_template_style_changed())
        self.fill_dir_var.trace_add("write", lambda *a: self._trigger_preview())
        self.ganging_strategy_var.trace_add("write", lambda *a: self._on_ganging_params_changed())
        self.max_overprint_var.trace_add("write", lambda *a: self._on_ganging_params_changed())

        self.order_qty_var.trace_add("write", lambda *a: self._recalculate_sheets())
        self.waste_var.trace_add("write", lambda *a: self._recalculate_sheets())

    def _build_tab_files(self, parent):
        # 0. Asosiy Ish Toifasi: Oddiy kesim (Gilotin) vs Pichoqli ish (Qolip/Noj)
        cat_frame = ttk.LabelFrame(parent, text="Ishlab Chiqarish Toifasi (Texnologiya)", padding=6)
        cat_frame.pack(fill=tk.X, padx=5, pady=(2, 4))

        ttk.Radiobutton(
            cat_frame,
            text="✂️ Oddiy kesim (Gilotin: vizitka, flayer, blank)",
            variable=self.job_category_var,
            value=JobCategory.GUILLOTINE.value,
            command=self._on_job_category_changed
        ).pack(side=tk.LEFT, padx=6)

        ttk.Radiobutton(
            cat_frame,
            text="📦 Pichoqli ish (Qolip / Shtants / Packaging)",
            variable=self.job_category_var,
            value=JobCategory.DIE_CUT.value,
            command=self._on_job_category_changed
        ).pack(side=tk.LEFT, padx=6)

        # 1. Rejim tanlagich: Yakka vs To'plam
        mode_frame = ttk.LabelFrame(parent, text="Buyurtma Tarkibi", padding=6)
        mode_frame.pack(fill=tk.X, padx=5, pady=4)

        ttk.Radiobutton(
            mode_frame,
            text="📄 Yakka dizayn (1 xil ekzemplyar)",
            variable=self.job_type_var,
            value="single",
            command=self._on_job_type_changed
        ).pack(side=tk.LEFT, padx=6)

        ttk.Radiobutton(
            mode_frame,
            text="📚 To'plam (Multi-dizayn: S, M, L / Vizitkalar)",
            variable=self.job_type_var,
            value="multi",
            command=self._on_job_type_changed
        ).pack(side=tk.LEFT, padx=6)

        # Dinamik konteyner (Yakka yoki To'plam paneli ko'rinadi)
        self.files_container = ttk.Frame(parent)
        self.files_container.pack(fill=tk.X, padx=5, pady=2)

        # A) Yakka dizayn paneli
        self.single_file_box = ttk.LabelFrame(self.files_container, text="Yakka Dizayn PDF Fayli", padding=8)
        ttk.Label(self.single_file_box, text="Oldi Dizayn (PDF):*", font=("Segoe UI", 9, "bold")).grid(row=0, column=0, sticky=tk.W, pady=2)
        ttk.Entry(self.single_file_box, textvariable=self.front_pdf_path, width=32).grid(row=0, column=1, sticky=tk.EW, padx=5)
        ttk.Button(self.single_file_box, text="Tanlash...", command=self._select_front_file).grid(row=0, column=2)
        self.single_file_box.columnconfigure(1, weight=1)

        # B) To'plam (Multi-Design) paneli
        self.multi_file_box = ttk.LabelFrame(self.files_container, text="To'plam Dizaynlar (S, M, L / Vizitkalar) va Tirajlar", padding=6)
        self._build_multi_variant_panel(self.multi_file_box)

        # Umumiy Orqa va Pichoq fayllari
        self.shared_box = ttk.LabelFrame(parent, text="Umumiy Orqa Dizayn Fayli (ixtiyoriy)", padding=6)
        self.shared_box.pack(fill=tk.X, padx=5, pady=3)

        ttk.Label(self.shared_box, text="Orqa Dizayn (umumiy):").grid(row=0, column=0, sticky=tk.W, pady=2)
        ttk.Entry(self.shared_box, textvariable=self.back_pdf_path, width=30).grid(row=0, column=1, sticky=tk.EW, padx=5)
        ttk.Button(self.shared_box, text="Tanlash...", command=self._select_back_file).grid(row=0, column=2)

        self.lbl_dieline = ttk.Label(self.shared_box, text="Pichoq / Die-cut (PDF):")
        self.entry_dieline = ttk.Entry(self.shared_box, textvariable=self.dieline_pdf_path, width=30)
        self.btn_dieline = ttk.Button(self.shared_box, text="Tanlash...", command=self._select_dieline_file)

        self.lbl_dieline.grid(row=1, column=0, sticky=tk.W, pady=2)
        self.entry_dieline.grid(row=1, column=1, sticky=tk.EW, padx=5)
        self.btn_dieline.grid(row=1, column=2)
        self.shared_box.columnconfigure(1, weight=1)

        # Preflight tugmasi
        btn_preflight = tk.Button(
            parent,
            text="🔍 PREFLIGHT TEKSHIRUVI (DPI, Ranglar, Shrift, Bleed)",
            bg="#28a745",
            fg="white",
            font=("Segoe UI", 9, "bold"),
            pady=4,
            command=self.run_preflight
        )
        btn_preflight.pack(fill=tk.X, padx=5, pady=4)

        # Preflight hisoboti ro'yxati
        rep_box = ttk.LabelFrame(parent, text="Preflight Hisoboti & Ogohlantirishlar", padding=4)
        rep_box.pack(fill=tk.BOTH, expand=True, padx=5, pady=3)

        self.tree_preflight = ttk.Treeview(
            rep_box,
            columns=("severity", "category", "message"),
            show="headings",
            height=5
        )
        self.tree_preflight.heading("severity", text="Holat")
        self.tree_preflight.heading("category", text="Bo'lim")
        self.tree_preflight.heading("message", text="Xabar va Tavsiya")
        self.tree_preflight.column("severity", width=65, anchor=tk.CENTER)
        self.tree_preflight.column("category", width=65, anchor=tk.CENTER)
        self.tree_preflight.column("message", width=310)

        tree_scroll = ttk.Scrollbar(rep_box, orient=tk.VERTICAL, command=self.tree_preflight.yview)
        self.tree_preflight.configure(yscrollcommand=tree_scroll.set)

        self.tree_preflight.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        ttk.Button(parent, text="💾 Preflight hisobotini JSON da saqlash", command=self._export_preflight_json).pack(anchor=tk.E, padx=5, pady=2)

        # Boshlang'ich holatda Yakka dizayn va Gilotin rejimini qo'llash
        self._on_job_type_changed()
        self._on_job_category_changed()

    def _build_multi_variant_panel(self, parent):
        # 1-qator: Ko'p sahifali PDF rejimi + Qo'shish/O'chirish tugmalari
        top_row = ttk.Frame(parent)
        top_row.pack(fill=tk.X, pady=(0, 3))

        ttk.Button(top_row, text="➕ PDF Qo'shish", command=self._add_multi_files).pack(side=tk.LEFT, padx=2)
        ttk.Button(top_row, text="🔄 Alohida Orqa...", command=self._assign_variant_back_file).pack(side=tk.LEFT, padx=2)
        ttk.Button(top_row, text="🗑️ O'chirish", command=self._remove_selected_variant).pack(side=tk.LEFT, padx=2)
        ttk.Button(top_row, text="🧹 Tozalash", command=self._clear_variants).pack(side=tk.LEFT, padx=2)

        mp_row = ttk.Frame(parent)
        mp_row.pack(fill=tk.X, pady=2)
        ttk.Label(mp_row, text="Ko'p betli PDF tartibi:").pack(side=tk.LEFT)
        ttk.Radiobutton(
            mp_row,
            text="Har bet = Alohida Oldi",
            variable=self.multi_page_mode_var,
            value="pages",
            command=self._on_multi_page_mode_changed
        ).pack(side=tk.LEFT, padx=4)
        ttk.Radiobutton(
            mp_row,
            text="Juftlik (1-Oldi, 2-Orqa...)",
            variable=self.multi_page_mode_var,
            value="alternating",
            command=self._on_multi_page_mode_changed
        ).pack(side=tk.LEFT, padx=4)

        # 2-qator: Turlar jadvali (Treeview)
        tbl_frame = ttk.Frame(parent)
        tbl_frame.pack(fill=tk.BOTH, expand=True, pady=2)

        self.tree_variants = ttk.Treeview(
            tbl_frame,
            columns=("id", "name", "pages", "qty", "alloc"),
            show="headings",
            height=5
        )
        self.tree_variants.heading("id", text="№")
        self.tree_variants.heading("name", text="Tur Nomi")
        self.tree_variants.heading("pages", text="Oldi / Orqa")
        self.tree_variants.heading("qty", text="Tiraj (dona)")
        self.tree_variants.heading("alloc", text="Forma : Katak")

        self.tree_variants.column("id", width=30, anchor=tk.CENTER)
        self.tree_variants.column("name", width=105)
        self.tree_variants.column("pages", width=95, anchor=tk.CENTER)
        self.tree_variants.column("qty", width=75, anchor=tk.E)
        self.tree_variants.column("alloc", width=130, anchor=tk.CENTER)

        v_scroll = ttk.Scrollbar(tbl_frame, orient=tk.VERTICAL, command=self.tree_variants.yview)
        self.tree_variants.configure(yscrollcommand=v_scroll.set)
        self.tree_variants.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        v_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_variants.bind("<<TreeviewSelect>>", self._on_variant_selected)

        # 3-qator: Tanlangan turni tezkor tahrirlash
        edit_row = ttk.Frame(parent)
        edit_row.pack(fill=tk.X, pady=3)

        ttk.Label(edit_row, text="Nomi:").pack(side=tk.LEFT)
        e_name = ttk.Entry(edit_row, textvariable=self.edit_var_name, width=11)
        e_name.pack(side=tk.LEFT, padx=3)

        ttk.Label(edit_row, text="Tiraj:").pack(side=tk.LEFT)
        e_qty = ttk.Entry(edit_row, textvariable=self.edit_var_qty, width=8)
        e_qty.pack(side=tk.LEFT, padx=3)

        ttk.Label(edit_row, text="Katak (0=Avto):").pack(side=tk.LEFT)
        e_slots = ttk.Entry(edit_row, textvariable=self.edit_var_slots, width=4)
        e_slots.pack(side=tk.LEFT, padx=3)

        btn_apply_var = ttk.Button(edit_row, text="✔️ Saqlash", command=self._apply_variant_edit)
        btn_apply_var.pack(side=tk.LEFT, padx=3)

        e_name.bind("<Return>", lambda e: self._apply_variant_edit())
        e_qty.bind("<Return>", lambda e: self._apply_variant_edit())
        e_slots.bind("<Return>", lambda e: self._apply_variant_edit())

        # 4-qator: Aqlli Forma va Tiraj Optimallashtirgich sozlamalari
        opt_row = ttk.Frame(parent)
        opt_row.pack(fill=tk.X, pady=2)

        ttk.Label(opt_row, text="Taqsimlash:").grid(row=0, column=0, sticky=tk.W)
        strat_combo = ttk.Combobox(
            opt_row,
            state="readonly",
            width=36,
            values=[
                "Aqlli: Har bir tur 1 ta formada (Kratnost + Klaster)",
                "Maksimal tejamkor: Formalar orasida bo'lish (Split)",
                "Yagona forma: 1 ta listga proporsional sig'dirish",
            ]
        )
        strat_combo.current(0)
        strat_combo.grid(row=0, column=1, columnspan=2, sticky=tk.EW, padx=3, pady=1)
        strat_combo.bind("<<ComboboxSelected>>", lambda e: self._on_strategy_combo_changed(strat_combo.current()))
        self._strat_combo = strat_combo

        ttk.Label(opt_row, text="Maks. ortiqcha tiraj (Perepechatka %):").grid(row=1, column=0, columnspan=2, sticky=tk.W, pady=2)
        ttk.Spinbox(opt_row, from_=0, to=100, increment=5, textvariable=self.max_overprint_var, width=6).grid(row=1, column=2, sticky=tk.W, padx=3)

    def _on_strategy_combo_changed(self, idx: int):
        if idx == 0:
            self.ganging_strategy_var.set(GangingStrategy.SMART_NO_SPLIT.value)
        elif idx == 1:
            self.ganging_strategy_var.set(GangingStrategy.MAX_ECONOMY_SPLIT.value)
        else:
            self.ganging_strategy_var.set(GangingStrategy.SINGLE_FORM_PROPORTIONAL.value)

    def _on_multi_page_mode_changed(self):
        """Foydalanuvchi 'Har bet = Alohida Oldi' va 'Juftlik (1-Oldi, 2-Orqa)' orasida almashganda PDFni qayta bo'lish."""
        if not self.variants:
            return
        unique_files = []
        for v in self.variants:
            if v.front_pdf_path and v.front_pdf_path not in unique_files:
                unique_files.append(v.front_pdf_path)
        if unique_files:
            self.variants.clear()
            self._load_files_into_variants(unique_files)

    def _on_job_type_changed(self):
        jtype = self.job_type_var.get()
        self.single_file_box.pack_forget()
        self.multi_file_box.pack_forget()
        if jtype == "multi":
            self.multi_file_box.pack(fill=tk.BOTH, expand=True)
            # Agar single fayl yuklangan bo'lsa va variants bo'sh bo'lsa, avtomatik qo'shamiz
            fp = self.front_pdf_path.get().strip()
            if not self.variants and fp and os.path.exists(fp):
                self._load_files_into_variants([fp])
        else:
            self.single_file_box.pack(fill=tk.X)
        self._recalculate_sheets()
        self._trigger_preview()

    def _add_multi_files(self):
        files = filedialog.askopenfilenames(filetypes=[("PDF Fayllar", "*.pdf")])
        if files:
            self._load_files_into_variants(list(files))

    def _load_files_into_variants(self, file_paths: List[str]):
        shared_back = self.back_pdf_path.get().strip() or None
        new_vars = ImpositionEngine.build_variants_from_files(
            front_files=file_paths,
            multi_page_mode=self.multi_page_mode_var.get(),
            shared_back_pdf=shared_back,
            default_quantity=1000,
            start_id=len(self.variants) + 1
        )
        if not new_vars:
            return
        self.variants.extend(new_vars)
        # Agar Orqa sahifalar topilgan bo'lsa, avtomatik Sheetwise rejimiga o'tkazish
        if any(v.back_pdf_path for v in new_vars):
            self.mode_var.set(ImpositionMode.SHEETWISE.value)
        if not self.front_pdf_path.get().strip():
            self.front_pdf_path.set(new_vars[0].front_pdf_path)
        if not self.job_name_var.get() or self.job_name_var.get() == "Montaj_Buyurtma":
            self.job_name_var.set(f"Toplam_{len(self.variants)}_tur")
        self.run_preflight()

    def _assign_variant_back_file(self):
        sel = self.tree_variants.selection()
        if not sel:
            messagebox.showinfo("Tanlanmagan", "Jadvaldan Orqa dizayn biriktirmoqchi bo'lgan turni tanlang!")
            return
        idx = self.tree_variants.index(sel[0])
        if 0 <= idx < len(self.variants):
            f = filedialog.askopenfilename(filetypes=[("PDF Fayllar", "*.pdf")])
            if f:
                self.variants[idx].back_pdf_path = f
                self.variants[idx].back_page_num = 0
                self.mode_var.set(ImpositionMode.SHEETWISE.value)
                self._recalculate_sheets()
                self._trigger_preview()

    def _remove_selected_variant(self):
        sel = self.tree_variants.selection()
        if not sel:
            return
        idx = self.tree_variants.index(sel[0])
        if 0 <= idx < len(self.variants):
            self.variants.pop(idx)
            for i, v in enumerate(self.variants):
                v.variant_id = i + 1
            self._recalculate_sheets()
            self._trigger_preview()

    def _clear_variants(self):
        self.variants.clear()
        self.last_form_plans.clear()
        self._refresh_variants_tree()
        self._trigger_preview()

    def _on_variant_selected(self, event=None):
        sel = self.tree_variants.selection()
        if not sel:
            return
        idx = self.tree_variants.index(sel[0])
        if 0 <= idx < len(self.variants):
            v = self.variants[idx]
            self.edit_var_name.set(v.name)
            self.edit_var_qty.set(v.order_quantity)
            self.edit_var_slots.set(v.assigned_slots if v.manual_slots else 0)

    def _apply_variant_edit(self):
        sel = self.tree_variants.selection()
        if not sel:
            return
        idx = self.tree_variants.index(sel[0])
        if 0 <= idx < len(self.variants):
            v = self.variants[idx]
            v.name = self.edit_var_name.get().strip() or v.name
            try:
                v.order_quantity = max(1, int(self.edit_var_qty.get()))
            except Exception:
                pass
            try:
                s_val = int(self.edit_var_slots.get())
                if s_val > 0:
                    v.assigned_slots = s_val
                    v.manual_slots = True
                else:
                    v.assigned_slots = 0
                    v.manual_slots = False
            except Exception:
                v.assigned_slots = 0
                v.manual_slots = False

            self._recalculate_sheets()
            self._trigger_preview()

    def _refresh_variants_tree(self):
        if not hasattr(self, "tree_variants"):
            return
        sel_idx = None
        sel = self.tree_variants.selection()
        if sel:
            sel_idx = self.tree_variants.index(sel[0])

        for item in self.tree_variants.get_children():
            self.tree_variants.delete(item)

        # Har bir variant qaysi formada nechta katak olganini aniqlash
        alloc_map = {}
        for fp in self.last_form_plans:
            for a in fp.allocations:
                alloc_map.setdefault(a.variant_index, []).append(
                    f"F{fp.form_index}:{a.slots}ta ({a.produced_qty:,})".replace(",", " ")
                )

        for i, v in enumerate(self.variants):
            front_lbl = f"B{v.front_page_num + 1}"
            if v.back_pdf_path:
                bp = (v.back_page_num or 0) + 1
                back_lbl = f"B{bp}"
            elif self.back_pdf_path.get().strip():
                back_lbl = "Umumiy"
            else:
                back_lbl = "Yo'q"

            alloc_str = " + ".join(alloc_map.get(i, ["-"]))
            self.tree_variants.insert(
                "",
                tk.END,
                values=(
                    v.variant_id,
                    v.name,
                    f"{front_lbl} / {back_lbl}",
                    f"{v.order_quantity:,}".replace(",", " "),
                    alloc_str
                )
            )

        children = self.tree_variants.get_children()
        if sel_idx is not None and 0 <= sel_idx < len(children):
            self.tree_variants.selection_set(children[sel_idx])

    def _on_ganging_params_changed(self):
        if self.job_type_var.get() == "multi":
            self._recalculate_sheets()
            self._trigger_preview()

    def _build_tab_layout(self, parent):
        box_sheet = ttk.LabelFrame(parent, text="Montaj Qog'ozi (Sheet)", padding=8)
        box_sheet.pack(fill=tk.X, padx=5, pady=4)

        ttk.Label(box_sheet, text="Standart Forma:").grid(row=0, column=0, sticky=tk.W)
        presets = ["500 x 350 mm", "700 x 500 mm", "640 x 450 mm", "SRA3 (450 x 320 mm)", "Qo'lda kiritish"]
        combo_sheet = ttk.Combobox(box_sheet, textvariable=self.sheet_preset, values=presets, state="readonly", width=22)
        combo_sheet.grid(row=0, column=1, columnspan=2, sticky=tk.EW, pady=3)
        combo_sheet.bind("<<ComboboxSelected>>", lambda e: self._on_sheet_preset_changed())

        ttk.Label(box_sheet, text="Kenglik (mm):").grid(row=1, column=0, sticky=tk.W)
        ttk.Entry(box_sheet, textvariable=self.sheet_w_var, width=8).grid(row=1, column=1, sticky=tk.W, pady=2)

        ttk.Label(box_sheet, text="Balandlik (mm):").grid(row=1, column=2, sticky=tk.W)
        ttk.Entry(box_sheet, textvariable=self.sheet_h_var, width=8).grid(row=1, column=3, sticky=tk.W, pady=2)

        ttk.Label(box_sheet, text="Klapan (Gripper mm):").grid(row=2, column=0, sticky=tk.W)
        ttk.Entry(box_sheet, textvariable=self.gripper_var, width=8).grid(row=2, column=1, sticky=tk.W, pady=2)

        box_prod = ttk.LabelFrame(parent, text="Mahsulot Kesimi, Ichki Oraliq (Gutter) va Tashqi Fon", padding=8)
        box_prod.pack(fill=tk.X, padx=5, pady=4)

        ttk.Label(box_prod, text="Kesim Kengligi (mm):").grid(row=0, column=0, sticky=tk.W)
        ttk.Entry(box_prod, textvariable=self.trim_w_var, width=8).grid(row=0, column=1, sticky=tk.W, pady=2)

        ttk.Label(box_prod, text="Kesim Balandligi (mm):").grid(row=0, column=2, sticky=tk.W)
        ttk.Entry(box_prod, textvariable=self.trim_h_var, width=8).grid(row=0, column=3, sticky=tk.W, pady=2)

        # Standart formatlar tezkor tugmalari (Presets)
        f_presets = ttk.Frame(box_prod)
        f_presets.grid(row=1, column=0, columnspan=4, sticky=tk.W, pady=(3, 5))
        ttk.Label(f_presets, text="Standart:", font=("Segoe UI", 8, "bold")).pack(side=tk.LEFT, padx=(0, 4))
        for name, pw, ph in [
            ("Vizitka 90x50", 90.0, 50.0),
            ("A6 105x148", 105.0, 148.0),
            ("A5 148x210", 148.0, 210.0),
            ("A4 210x297", 210.0, 297.0),
            ("100x100", 100.0, 100.0),
        ]:
            b = ttk.Button(f_presets, text=name, command=lambda _w=pw, _h=ph: self._set_product_preset(_w, _h))
            b.pack(side=tk.LEFT, padx=1)

        # Kesish usuli konteyneri (Gilotin yoki Pichoq rejimiga moslashadi)
        self.f_cut_container = ttk.Frame(box_prod)
        self.f_cut_container.grid(row=2, column=0, columnspan=4, sticky=tk.W, pady=3)

        self.f_gut_guillotine = ttk.Frame(self.f_cut_container)
        ttk.Label(self.f_gut_guillotine, text="Gilotin Kesish Usuli:", font=("Segoe UI", 8, "bold")).pack(anchor=tk.W, pady=(0, 1))
        ttk.Radiobutton(self.f_gut_guillotine, text="✂️ 2 ta pichoq bilan (3 mm tasma / Rangli fon, vizitka, flayer)", variable=self.gutter_mode_var, value="double").pack(anchor=tk.W, pady=1)
        ttk.Radiobutton(self.f_gut_guillotine, text="📄 1 ta pichoq bilan (0 mm / Flush cut, oq fon, blank)", variable=self.gutter_mode_var, value="single").pack(anchor=tk.W, pady=1)
        ttk.Radiobutton(self.f_gut_guillotine, text="⚙️ Qo'lda sozlash (Custom)", variable=self.gutter_mode_var, value="custom").pack(anchor=tk.W, pady=1)

        self.f_gut_diecut = ttk.Frame(self.f_cut_container)
        ttk.Label(self.f_gut_diecut, text="Pichoqli Ish Oralig'i:", font=("Segoe UI", 8, "bold")).pack(anchor=tk.W, pady=(0, 1))
        ttk.Radiobutton(self.f_gut_diecut, text="📦 Noj / Pichoq (3mm oraliq, 3mm tashqi fon)", variable=self.gutter_mode_var, value="diecut").pack(anchor=tk.W, pady=1)
        ttk.Radiobutton(self.f_gut_diecut, text="📄 0 mm oraliq (Flush cut)", variable=self.gutter_mode_var, value="flush").pack(anchor=tk.W, pady=1)
        ttk.Radiobutton(self.f_gut_diecut, text="⚙️ Qo'lda sozlash (Custom)", variable=self.gutter_mode_var, value="custom").pack(anchor=tk.W, pady=1)

        # Boshlang'ich holatda gilotin ko'rinadi
        self.f_gut_guillotine.pack(fill=tk.X)

        ttk.Label(box_prod, text="Ichki oraliq (Gutter mm):").grid(row=3, column=0, sticky=tk.W)
        ttk.Entry(box_prod, textvariable=self.gutter_var, width=8).grid(row=3, column=1, sticky=tk.W, pady=2)

        ttk.Label(box_prod, text="Tashqi 4 taraf fon (mm):").grid(row=3, column=2, sticky=tk.W)
        ttk.Entry(box_prod, textvariable=self.outer_bleed_var, width=8).grid(row=3, column=3, sticky=tk.W, pady=2)

        ttk.Label(box_prod, text="Ichki har bir fon (mm):").grid(row=4, column=0, sticky=tk.W)
        ttk.Entry(box_prod, textvariable=self.inner_bleed_var, width=8).grid(row=4, column=1, sticky=tk.W, pady=2)

        ttk.Label(box_prod, text="Krop masofasi (Gap mm):").grid(row=4, column=2, sticky=tk.W)
        ttk.Entry(box_prod, textvariable=self.crop_gap_var, width=8).grid(row=4, column=3, sticky=tk.W, pady=2)

        box_grid = ttk.LabelFrame(parent, text="Joylashtirish (Grid & Qolip)", padding=8)
        box_grid.pack(fill=tk.X, padx=5, pady=4)
        self.box_grid_container = box_grid

        ttk.Checkbutton(
            box_grid,
            text="Avtomatik optimal sig'imni topish (0° va 90° solishtirish)",
            variable=self.auto_grid_var,
            command=self._recalculate_grid
        ).grid(row=0, column=0, columnspan=4, sticky=tk.W, pady=2)

        ttk.Label(box_grid, text="Ustunlar (Cols):").grid(row=1, column=0, sticky=tk.W)
        ttk.Spinbox(box_grid, from_=1, to=50, textvariable=self.cols_var, width=6).grid(row=1, column=1, sticky=tk.W)

        ttk.Label(box_grid, text="Qatorlar (Rows):").grid(row=1, column=2, sticky=tk.W)
        ttk.Spinbox(box_grid, from_=1, to=50, textvariable=self.rows_var, width=6).grid(row=1, column=3, sticky=tk.W)

        ttk.Label(box_grid, text="Aylantirish (Rotation):").grid(row=2, column=0, sticky=tk.W)
        combo_rot = ttk.Combobox(box_grid, textvariable=self.rotation_var, values=[0, 90, 180, 270], width=6, state="readonly")
        combo_rot.grid(row=2, column=1, sticky=tk.W, pady=2)

        ttk.Label(box_grid, text="Bosma Tomoni:").grid(row=3, column=0, sticky=tk.W, pady=2)
        f_mode = ttk.Frame(box_grid)
        f_mode.grid(row=3, column=1, columnspan=3, sticky=tk.W)
        ttk.Radiobutton(f_mode, text="Faqat Oldi", variable=self.mode_var, value=ImpositionMode.SINGLE_SIDED.value).pack(side=tk.LEFT, padx=2)
        ttk.Radiobutton(f_mode, text="Oldi + Orqa (Sheetwise)", variable=self.mode_var, value=ImpositionMode.SHEETWISE.value).pack(side=tk.LEFT, padx=2)

        ttk.Label(box_grid, text="To'plam Tartibi:").grid(row=4, column=0, sticky=tk.W, pady=2)
        f_fill = ttk.Frame(box_grid)
        f_fill.grid(row=4, column=1, columnspan=3, sticky=tk.W)
        ttk.Radiobutton(f_fill, text="Ustun bo'yicha (Vertikal tasma)", variable=self.fill_dir_var, value=GridFillDirection.COL_BY_COL.value).pack(side=tk.LEFT, padx=2)
        ttk.Radiobutton(f_fill, text="Qator bo'yicha (Gorizontal)", variable=self.fill_dir_var, value=GridFillDirection.ROW_BY_ROW.value).pack(side=tk.LEFT, padx=2)

        # Varaqda joylashuv (Alignment: Center vs Gripper)
        ttk.Label(box_grid, text="Varaqda Joylashuv:").grid(row=5, column=0, sticky=tk.W, pady=2)
        f_align = ttk.Frame(box_grid)
        f_align.grid(row=5, column=1, columnspan=3, sticky=tk.W)
        ttk.Radiobutton(f_align, text="🎯 Varaq markazida (avto-sentr)", variable=self.sheet_alignment_var, value=SheetAlignment.CENTER.value).pack(side=tk.LEFT, padx=2)
        ttk.Radiobutton(f_align, text="📏 Klapan bo'yicha (pastda klapan)", variable=self.sheet_alignment_var, value=SheetAlignment.GRIPPER.value).pack(side=tk.LEFT, padx=2)

    def _build_tab_passport(self, parent):
        box_meta = ttk.LabelFrame(parent, text="Buyurtma Pasporti Ma'lumotlari", padding=8)
        box_meta.pack(fill=tk.X, padx=5, pady=4)

        ttk.Label(box_meta, text="Buyurtma №:").grid(row=0, column=0, sticky=tk.W)
        ttk.Entry(box_meta, textvariable=self.order_num_var, width=15).grid(row=0, column=1, sticky=tk.W, pady=2)

        ttk.Label(box_meta, text="Sana:").grid(row=0, column=2, sticky=tk.W)
        ttk.Entry(box_meta, textvariable=self.date_var, width=12).grid(row=0, column=3, sticky=tk.W, pady=2)

        ttk.Label(box_meta, text="Ish / Fayl nomi:").grid(row=1, column=0, sticky=tk.W)
        ttk.Entry(box_meta, textvariable=self.job_name_var, width=28).grid(row=1, column=1, columnspan=3, sticky=tk.EW, pady=2)

        ttk.Label(box_meta, text="Buyurtma soni (dona):").grid(row=2, column=0, sticky=tk.W)
        entry_qty = ttk.Entry(box_meta, textvariable=self.order_qty_var, width=15)
        entry_qty.grid(row=2, column=1, sticky=tk.W, pady=2)

        ttk.Label(box_meta, text="Brak / Priladka (list):").grid(row=2, column=2, sticky=tk.W)
        entry_w = ttk.Entry(box_meta, textvariable=self.waste_var, width=12)
        entry_w.grid(row=2, column=3, sticky=tk.W, pady=2)

        box_result = tk.Frame(box_meta, bg="#eef5fc", bd=1, relief=tk.SOLID, padx=10, pady=6)
        box_result.grid(row=3, column=0, columnspan=4, sticky=tk.EW, pady=6)

        tk.Label(box_result, text="BOSILISHI KERAK BO'LGAN LISTLAR SONI:", font=("Segoe UI", 9, "bold"), bg="#eef5fc", fg="#004085").pack()
        self.lbl_calc_sheets = tk.Label(box_result, textvariable=self.calc_sheets_var, font=("Segoe UI", 15, "bold"), bg="#eef5fc", fg="#d9534f")
        self.lbl_calc_sheets.pack()
        tk.Label(box_result, textvariable=self.forms_summary_var, font=("Segoe UI", 8), bg="#eef5fc", fg="#333").pack()

        box_style = ttk.LabelFrame(parent, text="Texnik Shablon Uslubi (Marks & Metadata)", padding=8)
        box_style.pack(fill=tk.X, padx=5, pady=4)

        ttk.Radiobutton(box_style, text="Standart Ofset (CMYK rang shkalasi, 4 ta krest, to'liq pasport)", variable=self.style_var, value=TemplateStyle.OFFSET_STANDARD.value).pack(anchor=tk.W, pady=2)
        ttk.Radiobutton(box_style, text="Raqamli / Ixcham (shkalasiz, faqat krop va qisqa pasport)", variable=self.style_var, value=TemplateStyle.DIGITAL_COMPACT.value).pack(anchor=tk.W, pady=2)
        ttk.Radiobutton(box_style, text="Packaging (Pichoqli quti: qo'shaloq krop, alohida pichoq)", variable=self.style_var, value=TemplateStyle.PACKAGING_DIE_CUT.value).pack(anchor=tk.W, pady=2)
        ttk.Radiobutton(box_style, text="Compact (0 mm oraliq, chapda to'liq pasport va ranglar)", variable=self.style_var, value=TemplateStyle.COMPACT_SIDE_INFO.value).pack(anchor=tk.W, pady=2)
        ttk.Radiobutton(box_style, text="Standard Colorbar (Keng CMYK shkala, burchak kroplar)", variable=self.style_var, value=TemplateStyle.STANDARD_COLORBAR.value).pack(anchor=tk.W, pady=2)

        box_colors = ttk.LabelFrame(parent, text="Aniqlangan Rang Kanallari (Har biri o'z bo'yog'ida)", padding=6)
        box_colors.pack(fill=tk.BOTH, expand=True, padx=5, pady=4)

        self.list_colors = tk.Listbox(box_colors, height=4, font=("Segoe UI", 9))
        self.list_colors.pack(fill=tk.BOTH, expand=True)

    def _build_preview_panel(self, parent):
        top_bar = ttk.Frame(parent, padding=5)
        top_bar.pack(fill=tk.X)

        ttk.Label(top_bar, text="Sahifa:", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=3)
        self.combo_page = ttk.Combobox(top_bar, values=["Oldi tomon"], state="readonly", width=32)
        self.combo_page.pack(side=tk.LEFT, padx=3)
        self.combo_page.bind("<<ComboboxSelected>>", self._on_preview_page_changed)

        btn_fit_page = ttk.Button(top_bar, text="📄 Butun sahifa (Fit Page)", command=self._fit_page)
        btn_fit_page.pack(side=tk.LEFT, padx=3)

        btn_fit_width = ttk.Button(top_bar, text="↔️ Kenglik (Fit Width)", command=self._fit_width)
        btn_fit_width.pack(side=tk.LEFT, padx=2)

        btn_actual = ttk.Button(top_bar, text="100%", command=self._actual_size)
        btn_actual.pack(side=tk.LEFT, padx=2)

        btn_zoom_in = ttk.Button(top_bar, text="➕ Zoom +", command=lambda: self._zoom(1.25))
        btn_zoom_in.pack(side=tk.LEFT, padx=2)

        btn_zoom_out = ttk.Button(top_bar, text="➖ Zoom -", command=lambda: self._zoom(0.8))
        btn_zoom_out.pack(side=tk.LEFT, padx=2)

        btn_refresh = tk.Button(
            top_bar,
            text="🔄 Yangilash",
            font=("Segoe UI", 8, "bold"),
            bg="#28a745",
            fg="white",
            activebackground="#218838",
            activeforeground="white",
            relief=tk.RAISED,
            padx=6,
            pady=1,
            command=self.force_regenerate
        )
        btn_refresh.pack(side=tk.LEFT, padx=4)

        self.lbl_info = ttk.Label(top_bar, text="Fayl yuklanmagan", foreground="#555")
        self.lbl_info.pack(side=tk.RIGHT, padx=5)

        self.progress_frame = ttk.Frame(parent, padding=(6, 2, 6, 2))
        self.progress_frame.pack(fill=tk.X)

        self.progress_bar = ttk.Progressbar(self.progress_frame, orient=tk.HORIZONTAL, mode="determinate", maximum=100)
        self.progress_bar.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8))

        self.lbl_progress_status = ttk.Label(self.progress_frame, text="Tayyor ✓", font=("Segoe UI", 8), foreground="#004085")
        self.lbl_progress_status.pack(side=tk.RIGHT)

        preview_container = ttk.Frame(parent)
        preview_container.pack(fill=tk.BOTH, expand=True)

        preview_container.rowconfigure(0, weight=1)
        preview_container.columnconfigure(0, weight=1)

        self.canvas = tk.Canvas(preview_container, bg="#2b2b2b", highlightthickness=0)
        vbar = ttk.Scrollbar(preview_container, orient=tk.VERTICAL, command=self.canvas.yview)
        hbar = ttk.Scrollbar(preview_container, orient=tk.HORIZONTAL, command=self.canvas.xview)

        self.canvas.configure(xscrollcommand=hbar.set, yscrollcommand=vbar.set)

        self.canvas.grid(row=0, column=0, sticky="nsew")
        vbar.grid(row=0, column=1, sticky="ns")
        hbar.grid(row=1, column=0, sticky="ew")

        self.canvas.bind("<Configure>", lambda e: self._on_canvas_resize())
        self.canvas.bind("<MouseWheel>", self._on_mousewheel)
        self.canvas.bind("<Shift-MouseWheel>", self._on_shift_mousewheel)
        self.canvas.bind("<Control-MouseWheel>", self._on_ctrl_mousewheel)

    # --- Hodisalar va Avto-yangilanish ---

    def _select_front_file(self):
        f = filedialog.askopenfilename(filetypes=[("PDF Fayllar", "*.pdf")])
        if f:
            self.front_pdf_path.set(f)
            if not self.job_name_var.get() or self.job_name_var.get() == "Montaj_Buyurtma":
                self.job_name_var.set(os.path.basename(f))
            # Agar PDF ko'p sahifali bo'lsa, foydalanuvchidan To'plam rejimida ochishni so'rash
            try:
                doc = pymupdf.open(f)
                p_cnt = len(doc)
                doc.close()
                if p_cnt > 1 and self.job_type_var.get() == "single":
                    ans = messagebox.askyesno(
                        "Ko'p sahifali PDF aniqlandi",
                        f"Tanlangan PDF faylda {p_cnt} ta sahifa mavjud.\n\n"
                        f"Har bir sahifani alohida dizayn (To'plam / Multi-dizayn) sifatida yuklashni xohlaysizmi?\n"
                        f"(Ha = To'plam rejimi, Yo'q = Oddiy yakka dizayn)"
                    )
                    if ans:
                        self.variants.clear()
                        self.job_type_var.set("multi")
                        self._on_job_type_changed()
                        return
            except Exception:
                pass
            self.run_preflight()

    def _select_back_file(self):
        f = filedialog.askopenfilename(filetypes=[("PDF Fayllar", "*.pdf")])
        if f:
            self.back_pdf_path.set(f)
            self.mode_var.set(ImpositionMode.SHEETWISE.value)
            # Agar To'plam rejimida bo'lsa va Orqa PDF tanlansa, har bir turga mos orqa sahifani bog'lash
            if self.variants and os.path.exists(f):
                try:
                    bdoc = pymupdf.open(f)
                    bcnt = len(bdoc)
                    bdoc.close()
                    for i, v in enumerate(self.variants):
                        v.back_pdf_path = f
                        v.back_page_num = i if i < bcnt else 0
                except Exception:
                    pass
            self._recalculate_sheets()
            self._trigger_preview()

    def _select_dieline_file(self):
        f = filedialog.askopenfilename(filetypes=[("PDF Fayllar", "*.pdf")])
        if f:
            self.dieline_pdf_path.set(f)
            try:
                dw_mm, dh_mm, die_page_w, die_page_h = ImpositionEngine.detect_dieline_trim_mm(f)

                self.trim_w_var.set(dw_mm)
                self.trim_h_var.set(dh_mm)

                # 1) Agar pichoq sahifasining o'zida hoshiya (bleed) bo'lsa (masalan: sahifa 100.674, pichoq 94.674 -> 3.0 mm)
                detected_b = 0.0
                if (die_page_w - dw_mm) >= 1.0 and (die_page_h - dh_mm) >= 1.0:
                    detected_b = round(min((die_page_w - dw_mm) / 2.0, (die_page_h - dh_mm) / 2.0), 1)

                # 2) Dizayn o'lchami bilan solishtirib bleedni aniqlash
                front_p = self.front_pdf_path.get().strip()
                if not front_p and self.variants:
                    front_p = self.variants[0].front_pdf_path
                if front_p and os.path.exists(front_p):
                    f_doc = pymupdf.open(front_p)
                    fp = f_doc[0]
                    fw_mm = fp.rect.width * 25.4 / 72.0
                    fh_mm = fp.rect.height * 25.4 / 72.0
                    f_doc.close()

                    w_diff = abs(fw_mm - dw_mm)
                    h_diff = abs(fh_mm - dh_mm)
                    w_rot = abs(fw_mm - dh_mm)
                    h_rot = abs(fh_mm - dw_mm)

                    if (w_rot + h_rot) < (w_diff + h_diff):
                        b_x = (fw_mm - dh_mm) / 2.0
                        b_y = (fh_mm - dw_mm) / 2.0
                    else:
                        b_x = (fw_mm - dw_mm) / 2.0
                        b_y = (fh_mm - dh_mm) / 2.0

                    fb = round(max(0.0, min(b_x, b_y)), 1)
                    if fb > 0:
                        detected_b = fb

                if detected_b > 0:
                    self.outer_bleed_var.set(detected_b)
                    self.inner_bleed_var.set(round(detected_b / 2.0, 1))
                    self.gutter_var.set(round(detected_b, 1))
            except Exception:
                pass
            self._recalculate_grid()
            self._trigger_preview()

    def _on_file_input_changed(self):
        p = self.front_pdf_path.get().strip()
        if p and os.path.exists(p) and p.lower().endswith(".pdf"):
            self.root.after(150, self.run_preflight)

    def _on_secondary_file_changed(self):
        self._recalculate_sheets()
        self._trigger_preview()

    def _on_grid_param_changed(self):
        self._recalculate_sheets()
        self._trigger_preview()

    def _set_progress(self, val: int, text: str = ""):
        if hasattr(self, "progress_bar"):
            self.progress_bar["value"] = val
        if hasattr(self, "lbl_progress_status") and text:
            self.lbl_progress_status.config(text=text)

    def _trigger_preview(self):
        if getattr(self, "_is_updating", False):
            self._pending_update = True
            return
        if hasattr(self, "_preview_after_id") and self._preview_after_id:
            self.root.after_cancel(self._preview_after_id)
        self._preview_after_id = self.root.after(80, self._update_preview)

    def force_regenerate(self):
        is_multi = (self.job_type_var.get() == "multi" and len(self.variants) > 0)
        pdf_path = self.front_pdf_path.get().strip()
        if not is_multi and (not pdf_path or not os.path.exists(pdf_path)):
            self.lbl_info.config(text="Avval PDF fayl yuklang!", foreground="#cc0000")
            self._set_progress(0, "Fayl yo'q")
            return

        self._pending_update = False
        self._is_updating = False
        if hasattr(self, "_preview_after_id") and self._preview_after_id:
            self.root.after_cancel(self._preview_after_id)
            self._preview_after_id = None

        self._set_progress(20, "Qolip parametrlari yangilanmoqda...")
        self.root.update_idletasks()

        self._recalculate_grid()
        self._set_progress(50, "Montaj qolipi hisoblandi...")
        self.root.update_idletasks()

        self._update_preview()

    def _on_sheet_preset_changed(self):
        if getattr(self, "_is_changing_preset", False):
            return
        self._is_changing_preset = True
        try:
            val = self.sheet_preset.get()
            if "500 x 350" in val:
                self.sheet_w_var.set(500.0)
                self.sheet_h_var.set(350.0)
            elif "700 x 500" in val:
                self.sheet_w_var.set(700.0)
                self.sheet_h_var.set(500.0)
            elif "640 x 450" in val:
                self.sheet_w_var.set(640.0)
                self.sheet_h_var.set(450.0)
            elif "SRA3" in val:
                self.sheet_w_var.set(450.0)
                self.sheet_h_var.set(320.0)

            self.auto_grid_var.set(True)
            self._recalculate_grid()
        finally:
            self._is_changing_preset = False

    def _on_sheet_dim_changed(self):
        if getattr(self, "_is_changing_preset", False):
            return
        self._check_custom_sheet_preset()
        self._recalculate_grid()

    def _check_custom_sheet_preset(self):
        if getattr(self, "_is_changing_preset", False):
            return
        try:
            w = round(self.sheet_w_var.get(), 1)
            h = round(self.sheet_h_var.get(), 1)
            if w == 500.0 and h == 350.0:
                p = "500 x 350 mm"
            elif w == 700.0 and h == 500.0:
                p = "700 x 500 mm"
            elif w == 640.0 and h == 450.0:
                p = "640 x 450 mm"
            elif w == 450.0 and h == 320.0:
                p = "SRA3 (450 x 320 mm)"
            else:
                p = "Qo'lda kiritish"
            if self.sheet_preset.get() != p:
                self._is_changing_preset = True
                self.sheet_preset.set(p)
                self._is_changing_preset = False
        except Exception:
            pass

    def _set_product_preset(self, w: float, h: float):
        self.trim_w_var.set(w)
        self.trim_h_var.set(h)
        self.auto_grid_var.set(True)
        self._recalculate_grid()

    def _on_job_category_changed(self):
        cat = self.job_category_var.get()
        if cat == JobCategory.GUILLOTINE.value:
            if hasattr(self, "lbl_dieline"):
                self.lbl_dieline.grid_remove()
                self.entry_dieline.grid_remove()
                self.btn_dieline.grid_remove()
            if hasattr(self, "shared_box"):
                self.shared_box.config(text="Umumiy Orqa Dizayn Fayli (ixtiyoriy)")
            if hasattr(self, "f_gut_guillotine") and hasattr(self, "f_gut_diecut"):
                self.f_gut_diecut.pack_forget()
                self.f_gut_guillotine.pack(fill=tk.X)
            if self.style_var.get() == TemplateStyle.PACKAGING_DIE_CUT.value:
                self.style_var.set(TemplateStyle.OFFSET_STANDARD.value)
            if self.gutter_mode_var.get() in ("diecut", "flush"):
                self.gutter_mode_var.set("double")
                self.gutter_var.set(3.0)
                self.inner_bleed_var.set(1.5)
                self.outer_bleed_var.set(2.0)
        else:
            if hasattr(self, "lbl_dieline"):
                self.lbl_dieline.grid()
                self.entry_dieline.grid()
                self.btn_dieline.grid()
            if hasattr(self, "shared_box"):
                self.shared_box.config(text="Umumiy Orqa va Pichoq (Die-cut) Fayllari")
            if hasattr(self, "f_gut_guillotine") and hasattr(self, "f_gut_diecut"):
                self.f_gut_guillotine.pack_forget()
                self.f_gut_diecut.pack(fill=tk.X)
            self.style_var.set(TemplateStyle.PACKAGING_DIE_CUT.value)
            if self.gutter_mode_var.get() in ("single", "double"):
                self.gutter_mode_var.set("diecut")
                self.gutter_var.set(3.0)
                self.inner_bleed_var.set(1.5)
                self.outer_bleed_var.set(3.0)

        self._recalculate_grid()
        self._trigger_preview()

    def _on_gutter_mode_changed(self):
        if getattr(self, "_is_syncing_style", False):
            return
        self._is_syncing_style = True
        try:
            m = self.gutter_mode_var.get()
            is_guillotine = (self.job_category_var.get() == JobCategory.GUILLOTINE.value)
            if m in ("single", "flush"):
                self.gutter_var.set(0.0)
                self.inner_bleed_var.set(0.0)
                self.outer_bleed_var.set(2.0 if is_guillotine else 3.0)
                self.crop_gap_var.set(1.0)
                if not is_guillotine:
                    self.style_var.set(TemplateStyle.COMPACT_SIDE_INFO.value)
            elif m == "double":
                self.gutter_var.set(3.0)
                self.inner_bleed_var.set(1.5)
                self.outer_bleed_var.set(2.0)
                self.crop_gap_var.set(1.0)
                if is_guillotine and self.style_var.get() in (TemplateStyle.COMPACT_SIDE_INFO.value, TemplateStyle.PACKAGING_DIE_CUT.value):
                    self.style_var.set(TemplateStyle.OFFSET_STANDARD.value)
            elif m == "diecut":
                self.gutter_var.set(3.0)
                self.inner_bleed_var.set(1.5)
                self.outer_bleed_var.set(3.0)
                self.crop_gap_var.set(1.0)
                self.style_var.set(TemplateStyle.PACKAGING_DIE_CUT.value)
            self._recalculate_grid()
        finally:
            self._is_syncing_style = False

    def _on_template_style_changed(self):
        if getattr(self, "_is_syncing_style", False):
            return
        self._is_syncing_style = True
        try:
            st = self.style_var.get()
            if st in (TemplateStyle.COMPACT_SIDE_INFO.value, TemplateStyle.DIGITAL_COMPACT.value):
                if self.job_category_var.get() == JobCategory.GUILLOTINE.value:
                    self.gutter_mode_var.set("single")
                else:
                    self.gutter_mode_var.set("flush")
                self.gutter_var.set(0.0)
                self.inner_bleed_var.set(0.0)
                self.outer_bleed_var.set(2.0)
                self.crop_gap_var.set(1.0)
            elif st == TemplateStyle.PACKAGING_DIE_CUT.value:
                self.gutter_mode_var.set("diecut")
                self.gutter_var.set(3.0)
                self.inner_bleed_var.set(1.5)
                self.outer_bleed_var.set(3.0)
                self.crop_gap_var.set(1.0)
            elif st == TemplateStyle.STANDARD_COLORBAR.value:
                self.gutter_mode_var.set("custom")
                self.gutter_var.set(2.0)
                self.inner_bleed_var.set(1.0)
                self.outer_bleed_var.set(2.0)
                self.crop_gap_var.set(1.0)
            self._recalculate_grid()
        finally:
            self._is_syncing_style = False

    def run_preflight(self):
        checker = PreflightChecker(target_dpi=300.0)
        expected_trim = (self.trim_w_var.get(), self.trim_h_var.get())

        if self.job_type_var.get() == "multi" and self.variants:
            report = checker.check_multi_variants(self.variants, expected_trim_mm=expected_trim)
        else:
            pdf_path = self.front_pdf_path.get().strip()
            if not pdf_path or not os.path.exists(pdf_path):
                return
            report = checker.check_pdf(pdf_path, expected_trim_mm=expected_trim)

        self.preflight_report = report

        for item in self.tree_preflight.get_children():
            self.tree_preflight.delete(item)

        for issue in report.issues:
            self.tree_preflight.insert("", tk.END, values=(issue.severity, issue.category, issue.message))

        self.list_colors.delete(0, tk.END)
        for c in report.colors:
            spot_tag = "[SPOT/PANTONE]" if c.is_spot else "[CMYK]"
            self.list_colors.insert(tk.END, f"{c.name} {spot_tag}")

        die_p = self.dieline_pdf_path.get().strip()
        if self.job_category_var.get() == JobCategory.DIE_CUT.value and die_p and os.path.exists(die_p):
            try:
                dw_mm, dh_mm, _, _ = ImpositionEngine.detect_dieline_trim_mm(die_p)
                self.trim_w_var.set(dw_mm)
                self.trim_h_var.set(dh_mm)
            except Exception:
                pass
        elif report.trim_box_mm[0] > 0 and report.trim_box_mm[1] > 0:
            self.trim_w_var.set(report.trim_box_mm[0])
            self.trim_h_var.set(report.trim_box_mm[1])
            mw, mh = report.media_box_mm
            tw, th = report.trim_box_mm
            if mw > tw or mh > th:
                detected_b = round(max(0.0, min((mw - tw) / 2.0, (mh - th) / 2.0)), 1)
                if detected_b > 0:
                    self.bleed_var.set(detected_b)
                    if self.gutter_mode_var.get() == "double":
                        self.inner_bleed_var.set(round(detected_b / 2.0, 1))
                        self.outer_bleed_var.set(detected_b)

        self._recalculate_grid()
        self._update_preview()

    def _export_preflight_json(self):
        if not self.preflight_report:
            messagebox.showinfo("Preflight o'tkazilmagan", "Avval Preflight tekshiruvini bajaring!")
            return
        f = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON Hisobot", "*.json")])
        if f:
            checker = PreflightChecker()
            checker.export_report_json(self.preflight_report, f)
            messagebox.showinfo("Saqlandi", f"Preflight hisoboti saqlandi:\n{f}")

    def _recalculate_grid(self):
        try:
            sheet_cfg = SheetConfig(
                width_mm=self.sheet_w_var.get(),
                height_mm=self.sheet_h_var.get(),
                margin_bottom_mm=self.gripper_var.get()
            )
            bg_cfg = BleedAndGutterConfig(
                trim_width_mm=self.trim_w_var.get(),
                trim_height_mm=self.trim_h_var.get(),
                bleed_mm=self.inner_bleed_var.get(),
                inner_bleed_mm=self.inner_bleed_var.get(),
                outer_bleed_mm=self.outer_bleed_var.get(),
                gutter_x_mm=self.gutter_var.get(),
                gutter_y_mm=self.gutter_var.get(),
                crop_gap_mm=self.crop_gap_var.get()
            )

            if self.auto_grid_var.get():
                grid = LayoutCalculator.calculate_optimal_grid(sheet_cfg, bg_cfg, allow_rotation=True)
                self.cols_var.set(grid["cols"])
                self.rows_var.set(grid["rows"])
                self.rotation_var.set(grid["rotation"])

            self._recalculate_sheets()
            self._trigger_preview()
        except Exception:
            pass

    def _recalculate_sheets(self):
        try:
            cols = max(1, self.cols_var.get())
            rows = max(1, self.rows_var.get())
            items_per_sheet = max(1, cols * rows)
            waste = self.waste_var.get()

            if self.job_type_var.get() == "multi" and self.variants:
                strat = GangingStrategy(self.ganging_strategy_var.get())
                max_over = self.max_overprint_var.get()
                plans = LayoutCalculator.optimize_ganged_forms(
                    variants=self.variants,
                    items_per_sheet=items_per_sheet,
                    strategy=strat,
                    max_overprint_pct=max_over,
                    waste_sheets=waste
                )
                self.last_form_plans = plans
                tot_sheets = sum(fp.total_sheets_with_waste for fp in plans)
                tot_qty = sum(v.order_quantity for v in self.variants)
                self.order_qty_var.set(tot_qty)
                self.calc_sheets_var.set(f"{tot_sheets:,} list".replace(",", " "))

                if len(plans) == 1:
                    self.forms_summary_var.set(f"1 ta forma ({plans[0].total_sheets_with_waste:,} list)".replace(",", " "))
                else:
                    parts = [f"F{fp.form_index}={fp.total_sheets_with_waste:,}".replace(",", " ") for fp in plans]
                    self.forms_summary_var.set(f"{len(plans)} ta forma: " + ", ".join(parts))

                self._refresh_variants_tree()
            else:
                qty = self.order_qty_var.get()
                sheets = LayoutCalculator.calculate_sheets_needed(qty, items_per_sheet, waste)
                self.calc_sheets_var.set(f"{sheets:,} list".replace(",", " "))
                self.forms_summary_var.set("1 ta forma (Yakka dizayn)")
        except Exception:
            pass

    def _get_active_colors(self):
        if self.preflight_report and self.preflight_report.colors:
            return self.preflight_report.colors
        return [
            ColorChannel("Cyan", False, (1, 0, 0, 0)),
            ColorChannel("Magenta", False, (0, 1, 0, 0)),
            ColorChannel("Yellow", False, (0, 0, 1, 0)),
            ColorChannel("Black", False, (0, 0, 0, 1)),
        ]

    def _update_preview(self):
        """Previewni 100% in-memory (xotirada) tezkor va Windows fayl qulflarisiz yaratish."""
        is_multi = (self.job_type_var.get() == "multi" and len(self.variants) > 0)
        pdf_path = self.front_pdf_path.get().strip()
        if not is_multi and (not pdf_path or not os.path.exists(pdf_path)):
            self.lbl_info.config(text="Fayl yuklanmagan")
            self.canvas.delete("all")
            return

        if self._is_updating:
            self._pending_update = True
            return
        self._is_updating = True
        t_start = time.perf_counter()
        self._set_progress(35, "Vektor montaj yaratilmoqda...")

        try:
            sheet_cfg = SheetConfig(
                width_mm=self.sheet_w_var.get(),
                height_mm=self.sheet_h_var.get(),
                margin_bottom_mm=self.gripper_var.get()
            )
            job_cat = JobCategory(self.job_category_var.get())
            align_enum = SheetAlignment(self.sheet_alignment_var.get())
            bg_cfg = BleedAndGutterConfig(
                trim_width_mm=self.trim_w_var.get(),
                trim_height_mm=self.trim_h_var.get(),
                bleed_mm=self.inner_bleed_var.get(),
                inner_bleed_mm=self.inner_bleed_var.get(),
                outer_bleed_mm=self.outer_bleed_var.get(),
                gutter_x_mm=self.gutter_var.get(),
                gutter_y_mm=self.gutter_var.get(),
                crop_gap_mm=self.crop_gap_var.get(),
                alignment=align_enum
            )
            mode_enum = ImpositionMode(self.mode_var.get())
            style_enum = TemplateStyle(self.style_var.get())
            fill_dir_enum = GridFillDirection(self.fill_dir_var.get())
            strat_enum = GangingStrategy(self.ganging_strategy_var.get())

            cols = max(1, self.cols_var.get())
            rows = max(1, self.rows_var.get())
            rot = self.rotation_var.get()

            job_meta = JobMetadata(
                order_number=self.order_num_var.get(),
                job_name=self.job_name_var.get() or (os.path.basename(pdf_path) if pdf_path else "Toplam"),
                date_str=self.date_var.get(),
                order_quantity=self.order_qty_var.get(),
                waste_sheets=self.waste_var.get(),
                colors=self._get_active_colors(),
                sheet_form_str=f"{int(sheet_cfg.width_mm/10)}x{int(sheet_cfg.height_mm/10)}sm",
                category=job_cat
            )

            back_p = self.back_pdf_path.get().strip() or None
            if back_p and not os.path.exists(back_p):
                back_p = None

            die_p = None
            if job_cat == JobCategory.DIE_CUT:
                raw_die = self.dieline_pdf_path.get().strip()
                if raw_die and os.path.exists(raw_die):
                    die_p = raw_die

            engine = ImpositionEngine()
            res = engine.run_imposition(
                front_pdf_path=pdf_path if not is_multi else None,
                back_pdf_path=back_p,
                dieline_pdf_path=die_p,
                sheet=sheet_cfg,
                bg_config=bg_cfg,
                mode=mode_enum,
                style=style_enum,
                job=job_meta,
                output_path=None,
                manual_grid=(cols, rows, rot),
                include_proof_overlay=True,
                variants=self.variants if is_multi else None,
                ganging_strategy=strat_enum,
                max_overprint_pct=self.max_overprint_var.get(),
                fill_direction=fill_dir_enum,
            )

            if is_multi and res.get("form_plans"):
                self.last_form_plans = res["form_plans"]
                self._refresh_variants_tree()

            if self.preview_doc is not None:
                self.preview_doc.close()
                self.preview_doc = None

            self.preview_doc = pymupdf.open(stream=res["pdf_bytes"], filetype="pdf")

            pages_list = res.get("page_labels") or []
            if not pages_list:
                page_count = len(self.preview_doc)
                for i in range(page_count):
                    pages_list.append(f"{i+1}-sahifa")

            self.combo_page["values"] = pages_list
            if self.current_preview_page >= len(pages_list):
                self.current_preview_page = 0
            self.combo_page.current(self.current_preview_page)

            elapsed_ms = max(1, int((time.perf_counter() - t_start) * 1000))
            forms_cnt = len(res.get("form_plans") or [])
            extra_info = f" | {forms_cnt} ta forma" if forms_cnt > 1 else ""
            self.lbl_info.config(
                text=f"Qolip: {cols}x{rows} ({cols*rows} ta/list){extra_info} | {sheet_cfg.width_mm:.0f}x{sheet_cfg.height_mm:.0f} mm | ✓ ({elapsed_ms} ms)",
                foreground="#006600"
            )

            self._fit_page()
            self._set_progress(100, f"Tayyor ✓ ({elapsed_ms} ms)")

        except Exception as e:
            self.lbl_info.config(text=f"Preview xatoligi: {str(e)}", foreground="#cc0000")
            self._set_progress(0, f"Xatolik: {str(e)[:30]}")
        finally:
            self._is_updating = False
            if getattr(self, "_pending_update", False):
                self._pending_update = False
                self.root.after(30, self._update_preview)

    def _render_canvas_page(self, center_scroll: bool = False):
        if not self.preview_doc or len(self.preview_doc) == 0:
            return

        try:
            page = self.preview_doc[self.current_preview_page]

            cw = self.canvas.winfo_width()
            ch = self.canvas.winfo_height()
            if cw <= 10:
                cw = 700
            if ch <= 10:
                ch = 600

            scale = max(0.1, self.zoom_level)
            mat = pymupdf.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=mat, alpha=False)

            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            self.preview_image_tk = ImageTk.PhotoImage(img)

            self.canvas.delete("all")
            margin = 25
            c_w = max(cw, pix.width + margin * 2)
            c_h = max(ch, pix.height + margin * 2)

            self.canvas.config(scrollregion=(0, 0, c_w, c_h))
            self.canvas.create_image(c_w / 2, c_h / 2, image=self.preview_image_tk, anchor=tk.CENTER)

            if center_scroll:
                self.canvas.xview_moveto(0)
                self.canvas.yview_moveto(0)

        except Exception:
            pass

    def _on_canvas_resize(self):
        if self.preview_doc:
            self._render_canvas_page()

    def _on_preview_page_changed(self, event=None):
        self.current_preview_page = self.combo_page.current()
        self._render_canvas_page()

    def _fit_page(self):
        if not self.preview_doc:
            return
        page = self.preview_doc[self.current_preview_page]
        cw = max(200, self.canvas.winfo_width() - 30)
        ch = max(200, self.canvas.winfo_height() - 30)
        scale_x = cw / page.rect.width
        scale_y = ch / page.rect.height
        self.zoom_level = min(scale_x, scale_y)
        self._render_canvas_page(center_scroll=True)

    def _fit_width(self):
        if not self.preview_doc:
            return
        page = self.preview_doc[self.current_preview_page]
        cw = max(200, self.canvas.winfo_width() - 30)
        self.zoom_level = cw / page.rect.width
        self._render_canvas_page(center_scroll=True)

    def _actual_size(self):
        self.zoom_level = 1.0
        self._render_canvas_page()

    def _fit_preview(self):
        self._fit_page()

    def _zoom(self, factor):
        self.zoom_level *= factor
        self.zoom_level = max(0.15, min(6.0, self.zoom_level))
        self._render_canvas_page()

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    def _on_shift_mousewheel(self, event):
        self.canvas.xview_scroll(int(-1 * (event.delta / 120)), "units")

    def _on_ctrl_mousewheel(self, event):
        if event.delta > 0:
            self._zoom(1.15)
        else:
            self._zoom(0.85)

    def run_imposition_flow(self):
        is_multi = (self.job_type_var.get() == "multi" and len(self.variants) > 0)
        pdf_path = self.front_pdf_path.get().strip()
        if not is_multi and (not pdf_path or not os.path.exists(pdf_path)):
            messagebox.showwarning("Xatolik", "Oldi dizayn PDF fayli tanlanmagan!")
            return

        out_path = filedialog.asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF Fayl", "*.pdf")],
            initialfile=f"montaj_{self.order_num_var.get().replace('№', '')}_{self.job_name_var.get()}.pdf"
        )
        if not out_path:
            return

        try:
            sheet_cfg = SheetConfig(
                width_mm=self.sheet_w_var.get(),
                height_mm=self.sheet_h_var.get(),
                margin_bottom_mm=self.gripper_var.get()
            )
            job_cat = JobCategory(self.job_category_var.get())
            align_enum = SheetAlignment(self.sheet_alignment_var.get())
            bg_cfg = BleedAndGutterConfig(
                trim_width_mm=self.trim_w_var.get(),
                trim_height_mm=self.trim_h_var.get(),
                bleed_mm=self.inner_bleed_var.get(),
                inner_bleed_mm=self.inner_bleed_var.get(),
                outer_bleed_mm=self.outer_bleed_var.get(),
                gutter_x_mm=self.gutter_var.get(),
                gutter_y_mm=self.gutter_var.get(),
                crop_gap_mm=self.crop_gap_var.get(),
                alignment=align_enum
            )
            mode_enum = ImpositionMode(self.mode_var.get())
            style_enum = TemplateStyle(self.style_var.get())
            fill_dir_enum = GridFillDirection(self.fill_dir_var.get())
            strat_enum = GangingStrategy(self.ganging_strategy_var.get())

            cols = max(1, self.cols_var.get())
            rows = max(1, self.rows_var.get())
            rot = self.rotation_var.get()

            job_meta = JobMetadata(
                order_number=self.order_num_var.get(),
                job_name=self.job_name_var.get(),
                date_str=self.date_var.get(),
                order_quantity=self.order_qty_var.get(),
                waste_sheets=self.waste_var.get(),
                colors=self._get_active_colors(),
                sheet_form_str=f"{int(sheet_cfg.width_mm/10)}x{int(sheet_cfg.height_mm/10)}sm",
                category=job_cat
            )

            back_p = self.back_pdf_path.get().strip() or None
            if back_p and not os.path.exists(back_p):
                back_p = None

            die_p = None
            if job_cat == JobCategory.DIE_CUT:
                raw_die = self.dieline_pdf_path.get().strip()
                if raw_die and os.path.exists(raw_die):
                    die_p = raw_die

            engine = ImpositionEngine()
            res = engine.run_imposition(
                front_pdf_path=pdf_path if not is_multi else None,
                back_pdf_path=back_p,
                dieline_pdf_path=die_p,
                sheet=sheet_cfg,
                bg_config=bg_cfg,
                mode=mode_enum,
                style=style_enum,
                job=job_meta,
                output_path=out_path,
                export_separate_files=self.export_separate_var.get(),
                manual_grid=(cols, rows, rot),
                variants=self.variants if is_multi else None,
                ganging_strategy=strat_enum,
                max_overprint_pct=self.max_overprint_var.get(),
                fill_direction=fill_dir_enum,
            )

            forms_info = ""
            if res.get("form_plans"):
                fps = res["form_plans"]
                forms_info = f"\nFormalar soni: {len(fps)} ta (" + ", ".join(
                    f"F{fp.form_index}: {fp.total_sheets_with_waste} list" for fp in fps
                ) + ")"

            msg = (
                f"Montaj muvaffaqiyatli saqlandi!\n\n"
                f"Fayl: {out_path}\n"
                f"Qolip: {res['cols']}x{res['rows']} ({res['items_per_sheet']} ta/list){forms_info}\n"
                f"Jami bosilishi kerak: {res['calculated_sheets']:,} list"
            ).replace(",", " ")

            if self.export_separate_files_count(res):
                msg += f"\n\nJami yaratilgan fayllar: {len(res['generated_files'])} ta"

            messagebox.showinfo("Tayyor", msg)

        except Exception as e:
            messagebox.showerror("Xatolik", f"Montajni amalga oshirishda xatolik yuz berdi:\n{str(e)}")

    def export_separate_files_count(self, res) -> bool:
        return self.export_separate_var.get() and len(res.get("generated_files", [])) > 1


def launch_gui():
    root = tk.Tk()
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass
    app = ImpositionApp(root)
    root.mainloop()


if __name__ == "__main__":
    launch_gui()
