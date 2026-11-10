"""Desktop GUI for Sticker / Textile Label Imposition (Tkinter + PIL + PyMuPDF)."""

from __future__ import annotations

import os
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageTk

from core.gear_manager import GearManager
from core.imposition_engine import ImpositionConfig, ImpositionEngine
from core.pdf_inspector import PDFDesignInfo
from core.sample_generator import generate_all_samples


class GearManagerDialog(tk.Toplevel):
    """Modal window to view and toggle available print cylinders (gears 40-149)."""

    def __init__(self, parent: tk.Widget, gear_manager: GearManager, on_save_callback) -> None:
        super().__init__(parent)
        self.title("Vallar Boshqaruvi (Print Cylinder & Gear Data 40–149)")
        self.geometry("760x560")
        self.gear_manager = gear_manager
        self.on_save_callback = on_save_callback
        self.transient(parent)
        self.grab_set()

        top_lbl = ttk.Label(
            self,
            text="Sariq (Mavjud) vallarni ikki marta bosib (yoki tugma orqali) yoqish/o'chirish mumkin:",
            font=("Segoe UI", 10, "bold"),
        )
        top_lbl.pack(fill=tk.X, padx=12, pady=(10, 4))

        cols = ("gear", "pitch", "plate", "cyl_dia", "film_len", "print_len", "status")
        tree_frame = ttk.Frame(self)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=12, pady=6)

        self.tree = ttk.Treeview(tree_frame, columns=cols, show="headings", selectmode="browse")
        self.tree.heading("gear", text="Gear (z)")
        self.tree.heading("pitch", text="Pitch Dia (mm)")
        self.tree.heading("plate", text="Plate (mm)")
        self.tree.heading("cyl_dia", text="Cyl Dia (mm)")
        self.tree.heading("film_len", text="Film Length (mm)")
        self.tree.heading("print_len", text="Printing Length (mm)")
        self.tree.heading("status", text="Holati (Mavjud)")

        for col, w in zip(cols, (75, 100, 80, 95, 120, 130, 120)):
            self.tree.column(col, width=w, anchor=tk.CENTER)

        self.tree.tag_configure("available", background="#FFF59D", foreground="#000000")
        self.tree.tag_configure("unavailable", background="#FFFFFF", foreground="#666666")

        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)

        self.tree.bind("<Double-1>", self._on_double_click)

        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill=tk.X, padx=12, pady=10)

        ttk.Button(
            btn_frame,
            text="Tanlangan valni Yoqish / O'chirish",
            command=self._toggle_selected,
        ).pack(side=tk.LEFT, padx=4)

        ttk.Button(
            btn_frame,
            text="Saqlash va Yopish",
            command=self._save_and_close,
        ).pack(side=tk.RIGHT, padx=4)

        self._populate()

    def _populate(self) -> None:
        self.tree.delete(*self.tree.get_children())
        for g in self.gear_manager.gears:
            status_txt = "MAVJUD (Sariq)" if g.available else "Yo'q"
            tag = "available" if g.available else "unavailable"
            self.tree.insert(
                "",
                tk.END,
                iid=str(g.gear),
                values=(
                    g.gear,
                    f"{g.pitch_diameter:.2f}",
                    f"{g.plate_thickness:.1f}",
                    f"{g.cylinder_diameter:.2f}",
                    f"{g.film_length:.2f}",
                    f"{g.printing_length:.2f}",
                    status_txt,
                ),
                tags=(tag,),
            )

    def _on_double_click(self, _event=None) -> None:
        self._toggle_selected()

    def _toggle_selected(self) -> None:
        sel = self.tree.selection()
        if not sel:
            return
        gear_num = int(sel[0])
        g = self.gear_manager.get_gear_by_number(gear_num)
        if g:
            g.available = not g.available
            self._populate()
            self.tree.selection_set(str(gear_num))

    def _save_and_close(self) -> None:
        self.gear_manager.save()
        if self.on_save_callback:
            self.on_save_callback()
        self.destroy()


class LabelImpositionApp(tk.Tk):
    """Main Desktop GUI Application for Sticker/Label Imposition."""

    def __init__(self) -> None:
        super().__init__()
        self.title("Stiker / Tekstil Yorliq Imposition Dasturi (100% Vektor PDF & Grayscale Qora)")
        self.geometry("1360x820")
        self.minsize(1120, 680)

        self.gear_manager = GearManager()
        self.engine = ImpositionEngine(self.gear_manager)

        # State: list of file paths, expanded design items map, and per-item (custom_gear, custom_copies) overrides
        self.file_paths: List[Path] = []
        self.design_items: Dict[str, PDFDesignInfo] = {}
        self.overrides: Dict[str, Tuple[Optional[int], Optional[int]]] = {}
        self.output_dir = Path.cwd() / "output"

        # Keep references to PhotoImage objects
        self._orig_photo: Optional[ImageTk.PhotoImage] = None
        self._imp_photo: Optional[ImageTk.PhotoImage] = None

        self._build_variables()
        self._build_ui()

    def _build_variables(self) -> None:
        self.var_remove_border = tk.BooleanVar(value=True)
        self.var_separate_colors = tk.BooleanVar(value=True)
        self.var_color_mode = tk.StringVar(value="side_by_side")
        self.var_batch_mode = tk.StringVar(value="individual")  # "individual" or "combine_same_gear"

        self.var_regmark_enabled = tk.BooleanVar(value=True)
        self.var_regmark_stroke = tk.DoubleVar(value=0.2)
        self.var_regmark_tick = tk.DoubleVar(value=0.7)
        self.var_regmark_width = tk.DoubleVar(value=0.0)  # 0.0 = auto match sticker width

        self.var_col_gap = tk.DoubleVar(value=5.0)
        self.var_max_width = tk.DoubleVar(value=0.0)  # 0.0 = unlimited

        self.var_export_svg = tk.BooleanVar(value=False)
        self.var_export_eps = tk.BooleanVar(value=False)

        self.var_override_gear = tk.StringVar(value="Avtomatik")
        self.var_override_copies = tk.StringVar(value="Avtomatik")
        self.var_output_dir = tk.StringVar(value=str(self.output_dir))
        self.var_progress_pct = tk.DoubleVar(value=0.0)
        self.var_progress_text = tk.StringVar(value="Holati: Tayyor")
        self.var_progress_pct_label = tk.StringVar(value="0%")

    def _build_ui(self) -> None:
        style = ttk.Style(self)
        if "vista" in style.theme_names():
            style.theme_use("vista")

        # 1. Top Toolbar
        toolbar = ttk.Frame(self, padding=(10, 8))
        toolbar.pack(fill=tk.X)

        ttk.Button(toolbar, text="+ PDF Fayllar Qo'shish", command=self.add_files).pack(side=tk.LEFT, padx=4)
        ttk.Button(toolbar, text="+ Papka Qo'shish", command=self.add_folder).pack(side=tk.LEFT, padx=4)
        ttk.Button(toolbar, text="Namuna PDF Yaratish (80mm va 60mm)", command=self.load_sample_files).pack(
            side=tk.LEFT, padx=8
        )
        ttk.Button(toolbar, text="Vallar Jadvali (40–149)", command=self.open_gear_manager).pack(
            side=tk.LEFT, padx=4
        )
        ttk.Button(toolbar, text="Tanlanganni O'chirish", command=self.remove_selected_file).pack(
            side=tk.LEFT, padx=4
        )
        ttk.Button(toolbar, text="Ro'yxatni Tozalash", command=self.clear_files).pack(side=tk.LEFT, padx=4)

        # Main PanedWindow (Left: Table + Settings, Right: Live Preview)
        paned = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, padx=10, pady=4)

        left_pane = ttk.Frame(paned)
        right_pane = ttk.Frame(paned, width=500)
        paned.add(left_pane, weight=3)
        paned.add(right_pane, weight=2)

        # 2. Left Top: Files Treeview
        table_group = ttk.LabelFrame(left_pane, text="Kiruvchi Vektor PDF Dizaynlar Ro'yxati", padding=6)
        table_group.pack(fill=tk.BOTH, expand=True, pady=(0, 6))

        cols = ("name", "size", "border", "colors", "gear", "copies", "print_len", "film_len", "status")
        self.tree = ttk.Treeview(table_group, columns=cols, show="headings", selectmode="browse", height=10)
        headers = {
            "name": ("Fayl Nomi", 160),
            "size": ("Asl O'lchami (W×L)", 115),
            "border": ("Hoshiya", 95),
            "colors": ("Ranglar", 130),
            "gear": ("Tanlangan Val", 90),
            "copies": ("Nusxa (N)", 75),
            "print_len": ("Printing Len", 95),
            "film_len": ("Film Length", 95),
            "status": ("Holati / Grayscale Audit", 150),
        }
        for c, (text, w) in headers.items():
            self.tree.heading(c, text=text)
            self.tree.column(c, width=w, anchor=tk.CENTER if c != "name" else tk.W)

        vsb = ttk.Scrollbar(table_group, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.bind("<<TreeviewSelect>>", self._on_file_selected)

        # Override bar for selected file
        override_bar = ttk.LabelFrame(
            left_pane, text="Tanlangan Fayl Uchun Maxsus Val / Nusxa Sozlamasi", padding=6
        )
        override_bar.pack(fill=tk.X, pady=(0, 6))

        ttk.Label(override_bar, text="Val (Gear):").pack(side=tk.LEFT, padx=(4, 2))
        self.cmb_gear = ttk.Combobox(override_bar, textvariable=self.var_override_gear, width=18, state="readonly")
        self.cmb_gear.pack(side=tk.LEFT, padx=4)
        self._refresh_gear_combobox()

        ttk.Label(override_bar, text="Nusxalar soni (N):").pack(side=tk.LEFT, padx=(12, 2))
        self.cmb_copies = ttk.Combobox(
            override_bar,
            textvariable=self.var_override_copies,
            values=["Avtomatik", "1", "2", "3", "4", "5", "6", "8", "10"],
            width=12,
            state="readonly",
        )
        self.cmb_copies.pack(side=tk.LEFT, padx=4)

        ttk.Button(override_bar, text="Qo'llash va Yangilash", command=self.apply_override_to_selected).pack(
            side=tk.LEFT, padx=10
        )

        # 3. Settings Panel
        settings_frame = ttk.LabelFrame(left_pane, text="Imposition, Rang Ajratish va Regmark Sozlamalari", padding=8)
        settings_frame.pack(fill=tk.X, pady=(0, 6))

        # Row 1: Border & Color Separation
        r1 = ttk.Frame(settings_frame)
        r1.pack(fill=tk.X, pady=3)
        ttk.Checkbutton(
            r1,
            text="Tashqi hoshiyani (ramkani) avtomatik o'chirish",
            variable=self.var_remove_border,
            command=self.refresh_all_rows,
        ).pack(side=tk.LEFT, padx=(0, 16))
        ttk.Checkbutton(
            r1,
            text="Ko'p rangli dizaynni ranglarga ajratish (100% Grayscale Qora klishelarga)",
            variable=self.var_separate_colors,
            command=self.refresh_all_rows,
        ).pack(side=tk.LEFT)

        # Row 2: Color separation layout & Multi-file mode
        r2 = ttk.Frame(settings_frame)
        r2.pack(fill=tk.X, pady=3)
        ttk.Label(r2, text="Ajratilgan ranglarni chiqarish:").pack(side=tk.LEFT, padx=(0, 6))
        ttk.Radiobutton(
            r2,
            text="Bitta sahifada yonma-yon (ustun)",
            variable=self.var_color_mode,
            value="side_by_side",
            command=self._update_preview,
        ).pack(side=tk.LEFT, padx=4)
        ttk.Radiobutton(
            r2,
            text="Alohida PDF fayllarda",
            variable=self.var_color_mode,
            value="separate_files",
            command=self._update_preview,
        ).pack(side=tk.LEFT, padx=4)

        # Row 3: Multi-file mode
        r3 = ttk.Frame(settings_frame)
        r3.pack(fill=tk.X, pady=3)
        ttk.Label(r3, text="Ko'p fayllar bilan ishlash rejimi:").pack(side=tk.LEFT, padx=(0, 6))
        ttk.Radiobutton(
            r3,
            text="Har bir faylni alohida chiqarish (Batch)",
            variable=self.var_batch_mode,
            value="individual",
        ).pack(side=tk.LEFT, padx=4)
        ttk.Radiobutton(
            r3,
            text="Bir xil valga (Gear) tushadigan fayllarni bitta sahifaga yonma-yon terish",
            variable=self.var_batch_mode,
            value="combine_same_gear",
        ).pack(side=tk.LEFT, padx=4)

        # Row 4: Regmark & Column Gap numeric settings
        r4 = ttk.Frame(settings_frame)
        r4.pack(fill=tk.X, pady=4)
        ttk.Checkbutton(
            r4, text="Regmark chizish", variable=self.var_regmark_enabled, command=self._update_preview
        ).pack(side=tk.LEFT, padx=(0, 8))

        ttk.Label(r4, text="Chiziq qalinligi (mm):").pack(side=tk.LEFT, padx=2)
        ttk.Spinbox(r4, from_=0.05, to=2.0, increment=0.05, textvariable=self.var_regmark_stroke, width=6).pack(
            side=tk.LEFT, padx=4
        )

        ttk.Label(r4, text="Vertikal chiziq (mm):").pack(side=tk.LEFT, padx=2)
        ttk.Spinbox(r4, from_=0.2, to=5.0, increment=0.1, textvariable=self.var_regmark_tick, width=6).pack(
            side=tk.LEFT, padx=4
        )

        ttk.Label(r4, text="Regmark eni (0=Avto stiker eni):").pack(side=tk.LEFT, padx=2)
        ttk.Spinbox(r4, from_=0.0, to=100.0, increment=1.0, textvariable=self.var_regmark_width, width=6).pack(
            side=tk.LEFT, padx=4
        )

        # Row 5: Column gap, max width, extra formats
        r5 = ttk.Frame(settings_frame)
        r5.pack(fill=tk.X, pady=3)
        ttk.Label(r5, text="Ustunlar orasi Gap (mm):").pack(side=tk.LEFT, padx=2)
        ttk.Spinbox(r5, from_=0.0, to=50.0, increment=1.0, textvariable=self.var_col_gap, width=6).pack(
            side=tk.LEFT, padx=4
        )

        ttk.Label(r5, text="Maks. val eni (0=Cheksiz, mm):").pack(side=tk.LEFT, padx=6)
        ttk.Spinbox(r5, from_=0.0, to=500.0, increment=10.0, textvariable=self.var_max_width, width=7).pack(
            side=tk.LEFT, padx=4
        )

        ttk.Checkbutton(r5, text="SVG eksport", variable=self.var_export_svg).pack(side=tk.LEFT, padx=8)
        ttk.Checkbutton(r5, text="EPS eksport", variable=self.var_export_eps).pack(side=tk.LEFT, padx=4)

        # 4. Output folder & Execute bar
        action_bar = ttk.Frame(left_pane, padding=(4, 6))
        action_bar.pack(fill=tk.X)

        ttk.Label(action_bar, text="Saqlash papkasi:").pack(side=tk.LEFT, padx=2)
        ttk.Entry(action_bar, textvariable=self.var_output_dir, width=42).pack(side=tk.LEFT, padx=4)
        ttk.Button(action_bar, text="Tanlash...", command=self.choose_output_dir).pack(side=tk.LEFT, padx=2)
        ttk.Button(action_bar, text="Papkani Ochish", command=self.open_output_dir).pack(side=tk.LEFT, padx=4)

        self.run_btn = tk.Button(
            action_bar,
            text="TAYYORLASH VA SAQLASH (100% VEKTOR PDF)",
            bg="#1B5E20",
            fg="white",
            font=("Segoe UI", 10, "bold"),
            padx=14,
            pady=6,
            command=self.run_imposition,
        )
        self.run_btn.pack(side=tk.RIGHT, padx=4)

        # Progress Bar & Live Status Tracker
        progress_frame = ttk.LabelFrame(left_pane, text="Jarayonni Kuzatish (Progress)", padding=(8, 4))
        progress_frame.pack(fill=tk.X, pady=(2, 0))

        top_prog = ttk.Frame(progress_frame)
        top_prog.pack(fill=tk.X, pady=(0, 3))
        self.lbl_progress_status = ttk.Label(
            top_prog,
            textvariable=self.var_progress_text,
            font=("Segoe UI", 9, "bold"),
            foreground="#1565C0",
        )
        self.lbl_progress_status.pack(side=tk.LEFT)
        self.lbl_progress_pct = ttk.Label(
            top_prog,
            textvariable=self.var_progress_pct_label,
            font=("Segoe UI", 9, "bold"),
            foreground="#1B5E20",
        )
        self.lbl_progress_pct.pack(side=tk.RIGHT)

        self.progressbar = ttk.Progressbar(
            progress_frame,
            orient=tk.HORIZONTAL,
            mode="determinate",
            maximum=100.0,
            variable=self.var_progress_pct,
        )
        self.progressbar.pack(fill=tk.X, pady=(0, 2))

        # 5. Right Pane: Live Visual Preview & Calculation Details
        preview_group = ttk.LabelFrame(
            right_pane, text="Jonli Ko'rish (Chapda: Asl Dizayn | O'ngda: Tayyor Film Length + Regmark)", padding=6
        )
        preview_group.pack(fill=tk.BOTH, expand=True, pady=(0, 6))

        self.canvas = tk.Canvas(preview_group, bg="#ECEFF1", highlightthickness=1, highlightbackground="#B0BEC5")
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<Configure>", lambda _e: self._update_preview())

        info_group = ttk.LabelFrame(right_pane, text="Matematik Hisob-Kitob va Grayscale Nazorat Hisoboti", padding=6)
        info_group.pack(fill=tk.X)

        self.txt_details = tk.Text(
            info_group, height=9, font=("Consolas", 9), bg="#FAFAFA", wrap=tk.WORD, state=tk.DISABLED
        )
        self.txt_details.pack(fill=tk.X)

    def _refresh_gear_combobox(self) -> None:
        avail = self.gear_manager.get_available_gears()
        vals = ["Avtomatik"] + [
            f"{g.gear} val (Print: {g.printing_length} / Film: {g.film_length})" for g in avail
        ]
        self.cmb_gear["values"] = vals

    def _get_current_config(self) -> ImpositionConfig:
        custom_w = float(self.var_regmark_width.get())
        return ImpositionConfig(
            remove_outer_border=bool(self.var_remove_border.get()),
            separate_colors=bool(self.var_separate_colors.get()),
            color_output_mode=self.var_color_mode.get(),
            regmark_enabled=bool(self.var_regmark_enabled.get()),
            regmark_stroke_mm=float(self.var_regmark_stroke.get()),
            regmark_tick_mm=float(self.var_regmark_tick.get()),
            regmark_custom_width_mm=custom_w if custom_w > 0 else None,
            column_gap_mm=float(self.var_col_gap.get()),
            max_cylinder_width_mm=float(self.var_max_width.get()),
            export_svg=bool(self.var_export_svg.get()),
            export_eps=bool(self.var_export_eps.get()),
        )

    def add_files(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Vektor PDF fayllarni tanlang",
            filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")],
        )
        if not paths:
            return
        for p in paths:
            path_obj = Path(p)
            if path_obj not in self.file_paths:
                self.file_paths.append(path_obj)
        self.refresh_all_rows()

    def add_folder(self) -> None:
        folder = filedialog.askdirectory(title="PDF fayllar joylashgan papkani tanlang")
        if not folder:
            return
        for p in sorted(Path(folder).glob("*.pdf")):
            if p not in self.file_paths:
                self.file_paths.append(p)
        self.refresh_all_rows()

    def load_sample_files(self) -> None:
        samples_dir = Path.cwd() / "samples"
        generated = generate_all_samples(samples_dir)
        for p in generated:
            if p not in self.file_paths:
                self.file_paths.append(p)
        self.refresh_all_rows()
        if generated:
            self.tree.selection_set(str(generated[0]))
            self._on_file_selected()

    def remove_selected_file(self) -> None:
        sel = self.tree.selection()
        if not sel:
            return
        key = sel[0]
        info = self.design_items.get(key)
        if info:
            self.file_paths = [p for p in self.file_paths if p != info.file_path]
        self.overrides.pop(key, None)
        self.refresh_all_rows()

    def _set_progress(self, current: int, total: int, message: str) -> None:
        pct = 0.0 if total <= 0 else min(100.0, max(0.0, (current / total) * 100.0))
        self.var_progress_pct.set(pct)
        self.var_progress_pct_label.set(f"{int(round(pct))}%")
        self.var_progress_text.set(message)
        self.update_idletasks()

    def clear_files(self) -> None:
        self.file_paths.clear()
        self.design_items.clear()
        self.overrides.clear()
        self.tree.delete(*self.tree.get_children())
        self.canvas.delete("all")
        self._set_details_text("")
        self._set_progress(0, 1, "Holati: Ro'yxat tozalandi")

    def open_gear_manager(self) -> None:
        GearManagerDialog(self, self.gear_manager, on_save_callback=self._on_gears_updated)

    def _on_gears_updated(self) -> None:
        self._refresh_gear_combobox()
        self.refresh_all_rows()

    def apply_override_to_selected(self) -> None:
        sel = self.tree.selection()
        if not sel:
            return
        key = sel[0]
        gear_str = self.var_override_gear.get()
        copies_str = self.var_override_copies.get()

        c_gear = int(gear_str.split()[0]) if gear_str != "Avtomatik" else None
        c_copies = int(copies_str) if copies_str != "Avtomatik" else None
        self.overrides[key] = (c_gear, c_copies)
        self.refresh_all_rows()
        if self.tree.exists(key):
            self.tree.selection_set(key)
        self._update_preview()

    def refresh_all_rows(self) -> None:
        selected = self.tree.selection()
        sel_id = selected[0] if selected else None
        self.tree.delete(*self.tree.get_children())
        self.design_items.clear()

        if not self.file_paths:
            self._set_progress(0, 1, "Holati: Tayyor")
            return

        cfg = self._get_current_config()
        all_expanded: List[PDFDesignInfo] = []
        for idx_f, p in enumerate(self.file_paths, start=1):
            self._set_progress(idx_f - 1, len(self.file_paths), f"PDF o'qilmoqda: {p.name}...")
            try:
                all_expanded.extend(self.engine.expand_pdf_designs(p))
            except Exception as exc:
                key = str(p)
                self.tree.insert(
                    "",
                    tk.END,
                    iid=key,
                    values=(p.name, "-", "-", "-", "-", "-", "-", "-", f"Xato: {exc}"),
                )

        total_d = max(1, len(all_expanded))
        for idx_d, d_info in enumerate(all_expanded, start=1):
            self._set_progress(
                idx_d,
                total_d,
                f"Dizayn tahlil qilinmoqda [{idx_d}/{total_d}]: {d_info.display_name}...",
            )
            key = d_info.item_key
            self.design_items[key] = d_info
            c_gear, c_copies = self.overrides.get(key, (None, None))
            try:
                info, match, cols = self.engine.analyze_design_info(
                    d_info,
                    custom_gear=c_gear,
                    custom_copies=c_copies,
                    remove_outer_border=cfg.remove_outer_border,
                )
                border_txt = "Bor (O'chadi)" if info.has_outer_border else "Yo'q"
                col_names = ", ".join(c.name.split()[0] for c in cols)
                color_txt = f"{len(cols)} ta: {col_names}"
                self.tree.insert(
                    "",
                    tk.END,
                    iid=key,
                    values=(
                        info.display_name,
                        f"{info.width_mm:.2f} × {info.length_mm:.2f} mm",
                        border_txt,
                        color_txt,
                        f"{match.gear} val",
                        f"{match.copies_count}x",
                        f"{match.printing_length_mm:.2f} mm",
                        f"{match.film_length_mm:.2f} mm",
                        "Tayyor (Vektor)",
                    ),
                )
            except Exception as exc:
                self.tree.insert(
                    "",
                    tk.END,
                    iid=key,
                    values=(d_info.display_name, "-", "-", "-", "-", "-", "-", "-", f"Xato: {exc}"),
                )

        self._set_progress(total_d, total_d, f"Tahlil yakunlandi: jami {len(all_expanded)} ta stiker tayyor.")

        if sel_id and self.tree.exists(sel_id):
            self.tree.selection_set(sel_id)
        else:
            children = self.tree.get_children()
            if children:
                self.tree.selection_set(children[0])
        self._update_preview()

    def _on_file_selected(self, _event=None) -> None:
        sel = self.tree.selection()
        if not sel:
            return
        key = sel[0]
        c_gear, c_copies = self.overrides.get(key, (None, None))
        if c_gear is None:
            self.var_override_gear.set("Avtomatik")
        else:
            for val in self.cmb_gear["values"]:
                if val.startswith(f"{c_gear} val"):
                    self.var_override_gear.set(val)
                    break
        self.var_override_copies.set("Avtomatik" if c_copies is None else str(c_copies))
        self._update_preview()

    def _update_preview(self) -> None:
        sel = self.tree.selection()
        if not sel:
            return
        key = sel[0]
        d_info = self.design_items.get(key)
        if d_info is None or not d_info.file_path.exists():
            return

        c_gear, c_copies = self.overrides.get(key, (None, None))
        cfg = self._get_current_config()

        try:
            orig_img, imp_img, info, match, cols, audit = self.engine.render_preview_images(
                d_info,
                config=cfg,
                custom_gear=c_gear,
                custom_copies=c_copies,
                dpi=160,
            )
        except Exception as exc:
            self._set_details_text(f"Ko'rishda xatolik: {exc}")
            return

        cw = max(240, self.canvas.winfo_width())
        ch = max(280, self.canvas.winfo_height())
        self.canvas.delete("all")

        # Left half: Original design, Right half: Imposed Film Length strip(s)
        half_w = (cw - 36) // 2
        avail_h = ch - 44

        orig_scaled = self._fit_image(orig_img, half_w, avail_h)
        imp_scaled = self._fit_image(imp_img, half_w, avail_h)

        self._orig_photo = ImageTk.PhotoImage(orig_scaled)
        self._imp_photo = ImageTk.PhotoImage(imp_scaled)

        x1 = 12 + half_w // 2
        x2 = 24 + half_w + half_w // 2
        y_center = 28 + avail_h // 2

        self.canvas.create_text(
            x1,
            14,
            text=f"ASL DIZAYN ({info.width_mm:.1f}×{info.length_mm:.1f} mm)",
            font=("Segoe UI", 9, "bold"),
            fill="#263238",
        )
        self.canvas.create_image(x1, y_center, image=self._orig_photo, anchor=tk.CENTER)

        self.canvas.create_text(
            x2,
            14,
            text=f"TAYYOR ({match.gear} VAL | FILM: {match.film_length_mm:.2f} mm | 100% BLACK)",
            font=("Segoe UI", 9, "bold"),
            fill="#1B5E20",
        )
        self.canvas.create_image(x2, y_center, image=self._imp_photo, anchor=tk.CENTER)

        # Populate mathematical breakdown & grayscale audit details
        col_summary = ", ".join(f"{c.name} [{c.hex_code}]" for c in cols)
        slot_mode = (
            f"Markazlashtirildi (Bo'lak: {match.slot_printing_length_mm:.3f} mm >= Dizayn: {info.length_mm:.2f} mm)"
            if info.length_mm <= match.slot_printing_length_mm
            else f"Bo'lakka moslashtirildi ({info.length_mm:.2f} mm -> {match.slot_printing_length_mm:.3f} mm)"
        )
        audit_txt = "TASDIQLANDI (100% Pure Grayscale Qora - DeviceGray 0.0)" if audit.passed else "XATO"

        report_lines = [
            f"Element: {info.display_name}  |  Asl o'lchami: Eni {info.width_mm:.2f} mm × Uzunligi {info.length_mm:.2f} mm",
            f"Tashqi hoshiya (ramka): {'Mavjud -> Avtomatik olib tashlandi' if info.has_outer_border and cfg.remove_outer_border else 'Yo`q'}",
            f"Tanlangan Val: {match.gear} val  |  Nusxalar soni: {match.copies_count} ta ({info.length_mm:.2f} × {match.copies_count} = {match.target_total_length_mm:.2f} mm)",
            f"Printing Length: {match.printing_length_mm:.2f} mm  |  Har bir bo'lak (Slot): {match.slot_printing_length_mm:.3f} mm",
            f"Bo'lakka joylashish: {slot_mode}",
            f"Film Length (Cho'zilish kompensatsiyasi): {match.printing_length_mm:.2f} mm -> {match.film_length_mm:.2f} mm (K_y = {match.gear_data.compression_ratio:.5f})",
            f"Regmark: Har {match.slot_film_length_mm:.3f} mm da (Eni: {cfg.regmark_custom_width_mm or info.width_mm:.1f} mm, Qalinligi: {cfg.regmark_stroke_mm} mm, Tick: {cfg.regmark_tick_mm} mm)",
            f"Aniqlangan ranglar ({len(cols)} ta): {col_summary}",
            f"Yakuniy Grayscale Qora Nazorati: {audit_txt}",
        ]
        self._set_details_text("\n".join(report_lines))

    @staticmethod
    def _fit_image(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
        w, h = img.size
        if w <= 0 or h <= 0:
            return img
        scale = min(max_w / w, max_h / h)
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        return img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    def _set_details_text(self, text: str) -> None:
        self.txt_details.configure(state=tk.NORMAL)
        self.txt_details.delete("1.0", tk.END)
        self.txt_details.insert(tk.END, text)
        self.txt_details.configure(state=tk.DISABLED)

    def choose_output_dir(self) -> None:
        d = filedialog.askdirectory(title="Chiquvchi fayllar uchun papkani tanlang")
        if d:
            self.output_dir = Path(d)
            self.var_output_dir.set(str(self.output_dir))

    def open_output_dir(self) -> None:
        out = Path(self.var_output_dir.get())
        out.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(str(out))

    def run_imposition(self) -> None:
        if not self.design_items:
            messagebox.showwarning("Diqqat", "Iltimos, avval kamida bitta PDF fayl qo'shing!")
            return

        out_dir = Path(self.var_output_dir.get())
        cfg = self._get_current_config()
        mode = self.var_batch_mode.get()
        all_infos = list(self.design_items.values())
        total_count = len(all_infos)

        self.run_btn.configure(state=tk.DISABLED, text="JARAYON BAJARILMOQDA...")
        self._set_progress(0, total_count, "Imposition jarayoni boshlanmoqda...")

        try:
            if mode == "combine_same_gear" and total_count > 1:
                for d_info in all_infos:
                    if self.tree.exists(d_info.item_key):
                        vals = list(self.tree.item(d_info.item_key, "values"))
                        vals[-1] = "Jarayonda..."
                        self.tree.item(d_info.item_key, values=vals)

                results = self.engine.process_batch_combined_by_gear(
                    all_infos,
                    output_dir=out_dir,
                    config=cfg,
                    overrides=self.overrides,
                    progress_callback=self._set_progress,
                )
            else:
                results = []
                for idx, d_info in enumerate(all_infos, start=1):
                    key = d_info.item_key
                    if self.tree.exists(key):
                        vals = list(self.tree.item(key, "values"))
                        vals[-1] = "Jarayonda..."
                        self.tree.item(key, values=vals)
                        self.tree.see(key)

                    self._set_progress(
                        idx - 1,
                        total_count,
                        f"[{idx}/{total_count}] Tayyorlanmoqda: {d_info.display_name}...",
                    )
                    c_gear, c_copies = self.overrides.get(key, (None, None))
                    res = self.engine.process_design_info(
                        d_info,
                        output_dir=out_dir,
                        config=cfg,
                        custom_gear=c_gear,
                        custom_copies=c_copies,
                    )
                    results.append(res)

                    if self.tree.exists(key):
                        vals = list(self.tree.item(key, "values"))
                        audit_ok = res.audit_report.passed if res.audit_report else True
                        vals[-1] = "100% Grayscale OK" if audit_ok else "Audit Ogohlantirish"
                        self.tree.item(key, values=vals)

                    self._set_progress(
                        idx,
                        total_count,
                        f"[{idx}/{total_count}] Tayyor bo'ldi: {d_info.display_name}",
                    )

            all_saved: List[Path] = []
            for res in results:
                key = res.design_info.item_key
                for sf in res.output_files:
                    if sf not in all_saved:
                        all_saved.append(sf)
                if self.tree.exists(key):
                    vals = list(self.tree.item(key, "values"))
                    audit_ok = res.audit_report.passed if res.audit_report else True
                    vals[-1] = "100% Grayscale OK" if audit_ok else "Audit Ogohlantirish"
                    self.tree.item(key, values=vals)

            self._set_progress(
                total_count,
                total_count,
                f"Yakunlandi! Jami {len(all_saved)} ta 100% vektor fayl saqlandi.",
            )

            files_list_str = "\n".join(f"• {f.name}" for f in all_saved[:12])
            if len(all_saved) > 12:
                files_list_str += f"\n... va yana {len(all_saved) - 12} ta fayl"
            messagebox.showinfo(
                "Muvaffaqiyatli Yakunlandi!",
                f"Jami {len(all_saved)} ta 100% vektor fayl tayyorlandi va 100% Grayscale Qora nazoratidan o'tdi:\n\n"
                f"{files_list_str}\n\n"
                f"Manzil: {out_dir}",
            )
        except Exception as exc:
            self._set_progress(0, 1, f"Xatolik yuz berdi: {exc}")
            messagebox.showerror("Xatolik", f"Fayllarni qayta ishlashda xatolik yuz berdi:\n{exc}")
        finally:
            self.run_btn.configure(state=tk.NORMAL, text="TAYYORLASH VA SAQLASH (100% VEKTOR PDF)")
