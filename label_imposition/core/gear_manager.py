"""Gear / Print Cylinder data management and automatic matching logic."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import List, Optional


DEFAULT_GEARS_PATH = Path(__file__).resolve().parent.parent / "data" / "gears.json"


@dataclass
class GearData:
    gear: int
    pitch_diameter: float
    plate_thickness: float
    cylinder_diameter: float
    film_length: float
    printing_length: float
    available: bool = True

    @property
    def compression_ratio(self) -> float:
        """Vertical scale factor from Printing length to Film length."""
        return self.film_length / self.printing_length


@dataclass
class GearMatch:
    gear_data: GearData
    design_length_mm: float
    copies_count: int  # N (number of repeats along cylinder circumference)
    target_total_length_mm: float  # N * design_length_mm
    slot_printing_length_mm: float  # printing_length / N
    slot_film_length_mm: float  # film_length / N
    total_diff_mm: float  # printing_length - (N * design_length_mm)
    per_copy_diff_mm: float  # slot_printing_length_mm - design_length_mm
    scale_in_slot_y: float  # < 1.0 if design_length_mm > slot_printing_length_mm else 1.0
    final_scale_y: float  # Total Y scale applied to original design in Film output

    @property
    def gear(self) -> int:
        return self.gear_data.gear

    @property
    def printing_length_mm(self) -> float:
        return self.gear_data.printing_length

    @property
    def film_length_mm(self) -> float:
        return self.gear_data.film_length


class GearManager:
    """Manages available print cylinders (gears) and finds optimal matches."""

    def __init__(self, json_path: Optional[Path] = None) -> None:
        self.json_path = Path(json_path) if json_path else DEFAULT_GEARS_PATH
        self.plate_thickness_mm: float = 1.7
        self.gears: List[GearData] = []
        self.load()

    def load(self) -> None:
        if not self.json_path.exists():
            raise FileNotFoundError(f"Gears data file not found: {self.json_path}")
        with open(self.json_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        self.plate_thickness_mm = float(raw.get("plate_thickness_mm", 1.7))
        self.gears = [GearData(**item) for item in raw.get("gears", [])]
        self.gears.sort(key=lambda g: g.gear)

    def save(self) -> None:
        self.json_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "plate_thickness_mm": self.plate_thickness_mm,
            "gears": [asdict(g) for g in sorted(self.gears, key=lambda x: x.gear)],
        }
        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def get_available_gears(self) -> List[GearData]:
        return [g for g in self.gears if g.available]

    def get_gear_by_number(self, gear_num: int) -> Optional[GearData]:
        for g in self.gears:
            if g.gear == gear_num:
                return g
        return None

    def set_gear_availability(self, gear_num: int, available: bool) -> bool:
        gear = self.get_gear_by_number(gear_num)
        if gear is None:
            return False
        gear.available = available
        return True

    def build_match(
        self,
        gear_data: GearData,
        design_length_mm: float,
        copies_count: int,
    ) -> GearMatch:
        copies_count = max(1, int(copies_count))
        slot_printing = gear_data.printing_length / copies_count
        slot_film = gear_data.film_length / copies_count
        target_total = design_length_mm * copies_count
        total_diff = gear_data.printing_length - target_total
        per_copy_diff = slot_printing - design_length_mm

        # If design length is larger than slot_printing (e.g., 80mm > 79.965mm),
        # it is scaled to fit the slot (79.965 / 80.0).
        # If design length <= slot_printing (e.g., 60mm <= 60.99mm),
        # it is centered in the 60.99mm slot (scale_in_slot_y = 1.0),
        # and then the whole printing length is compressed to film_length!
        if design_length_mm > slot_printing:
            scale_in_slot_y = slot_printing / design_length_mm
        else:
            scale_in_slot_y = 1.0

        final_scale_y = scale_in_slot_y * gear_data.compression_ratio

        return GearMatch(
            gear_data=gear_data,
            design_length_mm=design_length_mm,
            copies_count=copies_count,
            target_total_length_mm=round(target_total, 4),
            slot_printing_length_mm=round(slot_printing, 6),
            slot_film_length_mm=round(slot_film, 6),
            total_diff_mm=round(total_diff, 4),
            per_copy_diff_mm=round(per_copy_diff, 4),
            scale_in_slot_y=scale_in_slot_y,
            final_scale_y=final_scale_y,
        )

    def find_best_gear(
        self,
        design_length_mm: float,
        custom_copies: Optional[int] = None,
        custom_gear: Optional[int] = None,
        only_available: bool = True,
    ) -> GearMatch:
        """
        Finds the best gear and number of copies (N) for a given design length (mm).
        Standard workflow:
        1. If custom_gear and/or custom_copies are provided, honor them.
        2. Otherwise, check if 2x (N=2) falls within the available gears range
           (since designers by default multiply design length by 2 and look up the closest
           Printing length, e.g., 80*2=160 -> 59 gear 159.93mm, 60*2=120 -> 45 gear 121.98mm).
        3. If 2x is outside the available gears range (e.g. very short 35mm or very long 120mm),
           evaluate all multipliers N = 1..15 and choose the closest match.
        """
        if design_length_mm <= 0:
            raise ValueError(f"Design length must be positive, got {design_length_mm}")

        candidates = self.get_available_gears() if only_available else list(self.gears)
        if not candidates:
            raise ValueError("No available gears configured in gears.json")

        if custom_gear is not None:
            g = self.get_gear_by_number(custom_gear)
            if g is None:
                raise ValueError(f"Gear {custom_gear} not found in table.")
            n = custom_copies if custom_copies is not None else max(1, round(g.printing_length / design_length_mm))
            return self.build_match(g, design_length_mm, n)

        if custom_copies is not None:
            n = max(1, int(custom_copies))
            target = design_length_mm * n
            best_g = min(candidates, key=lambda g: abs(g.printing_length - target))
            return self.build_match(best_g, design_length_mm, n)

        min_printing = min(g.printing_length for g in candidates)
        max_printing = max(g.printing_length for g in candidates)

        target_2x = design_length_mm * 2.0
        # Designers allow a tiny shrink tolerance (e.g. <= 0.25 mm total, like 160.0 -> 159.93 mm on Gear 59),
        # otherwise they pick the closest gear whose Printing length >= target (like 120.0 -> 121.98 mm on Gear 45
        # rather than shrinking by 0.73 mm to Gear 44's 119.27 mm) and center the design in each slot.
        shrink_tol_mm = 0.25

        if (min_printing - shrink_tol_mm) <= target_2x <= (max_printing + 6.0):
            gears_ge = [g for g in candidates if g.printing_length >= (target_2x - shrink_tol_mm)]
            if gears_ge:
                best_g_2x = min(gears_ge, key=lambda g: abs(g.printing_length - target_2x))
            else:
                best_g_2x = min(candidates, key=lambda g: abs(g.printing_length - target_2x))
            return self.build_match(best_g_2x, design_length_mm, 2)

        # Otherwise, search across all multipliers N = 1..20 with preference for Printing_length >= N * L - shrink_tol
        best_match: Optional[GearMatch] = None
        best_score = float("inf")
        for g in candidates:
            n = max(1, round(g.printing_length / design_length_mm))
            m = self.build_match(g, design_length_mm, n)
            # Penalize shrinking beyond shrink_tol_mm
            penalty = 0.0 if m.total_diff_mm >= -shrink_tol_mm else abs(m.total_diff_mm) * 3.0
            score = abs(m.total_diff_mm) + penalty
            if score < best_score:
                best_score = score
                best_match = m

        assert best_match is not None
        return best_match

    def rank_all_candidates(
        self,
        design_length_mm: float,
        only_available: bool = True,
        limit: int = 10,
    ) -> List[GearMatch]:
        """Returns top candidate (Gear, N) combinations sorted by closeness."""
        candidates = self.get_available_gears() if only_available else list(self.gears)
        matches: List[GearMatch] = []
        for g in candidates:
            n = max(1, round(g.printing_length / design_length_mm))
            matches.append(self.build_match(g, design_length_mm, n))
        matches.sort(key=lambda m: (abs(m.per_copy_diff_mm), abs(m.total_diff_mm)))
        return matches[:limit]
