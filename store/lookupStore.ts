"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ComboboxItem } from "@/components/ui/smart-combobox";
import { MOCK_CUSTOMERS, SITE_OPTIONS, SiteOption } from "@/components/documents/work-order/types";

export interface LookupPresetItem extends ComboboxItem {
  width?: number;
  height?: number;
  category?: string;
}

const DEFAULT_FORMATS: ComboboxItem[] = [
  { value: "Hangtag", label: "Hangtag (Clothing / Retail Tag)" },
  { value: "Label", label: "Label (Self-adhesive / Woven)" },
  { value: "Card", label: "Card (Insert / Postcard)" },
  { value: "Sticker", label: "Sticker (Die-cut roll/sheet)" },
  { value: "Jacquard Ribbon", label: "Jacquard Ribbon (Woven band)" },
  { value: "Carton", label: "Carton Box (Folding packaging)" },
  { value: "Sleeve", label: "Packaging Sleeve (Belly band)" },
];

const DEFAULT_CORNER_TYPES: ComboboxItem[] = [
  { value: "Square Cut", label: "Square Cut (90° guillotine)" },
  { value: "Round Corners (R3)", label: "Round Corners (R3)" },
  { value: "Round Corners (R5)", label: "Round Corners (R5)" },
  { value: "Die-cut Contour", label: "Die-cut Contour (Steel rule)" },
  { value: "Center Fold", label: "Center Fold (Loop fold)" },
  { value: "End Fold", label: "End Fold (Booklet fold)" },
  { value: "Miter Fold", label: "Miter Fold (Hanger fold)" },
];

const DEFAULT_PAPER_STOCKS: ComboboxItem[] = [
  { value: "Galerie Art Silk 150g/m²", label: "Galerie Art Silk 150g/m²", description: "Premium coated semi-matte paper", badge: "Paper" },
  { value: "Coated Cardboard 300g/m²", label: "Coated Cardboard 300g/m²", description: "Solid bleached board (SBB/GZ)", badge: "Board" },
  { value: "Kraft Board Brown 280g/m²", label: "Kraft Board Brown 280g/m²", description: "Natural unbleached eco kraft paper", badge: "Kraft" },
  { value: "Offset Woodfree 80g/m²", label: "Offset Woodfree 80g/m²", description: "Standard uncoated office book paper", badge: "Paper" },
  { value: "White Satin Ribbon 60mm", label: "White Satin Ribbon 60mm", description: "Polyester woven edge soft satin", badge: "Flexo" },
  { value: "Nylon Taffeta Tape 50mm", label: "Nylon Taffeta Tape 50mm", description: "Tear-resistant heat sealable tape", badge: "Flexo" },
  { value: "Gloss Art Paper 130g/m²", label: "Gloss Art Paper 130g/m²", description: "High-gloss magazine/flyer paper", badge: "Paper" },
];

const DEFAULT_COATINGS: ComboboxItem[] = [
  { value: "None / Uncoated", label: "None / Uncoated", description: "Raw natural paper surface" },
  { value: "Matte Lamination (1S)", label: "Matte Lamination (1S)", description: "1-sided scratch-resistant matte film" },
  { value: "Gloss Lamination (1S)", label: "Gloss Lamination (1S)", description: "1-sided high-shine protective film" },
  { value: "Soft-Touch Matte + Spot UV", label: "Soft-Touch Matte + Spot UV", description: "Velvet touch film with raised gloss UV" },
  { value: "Overall Water-based Matte Varnish", label: "Overall WB Matte Varnish", description: "Machine seal coating against rub" },
  { value: "Gold Hot Foil Stamping", label: "Gold Hot Foil Stamping", description: "Metallic foil block embossed" },
  { value: "Silver Hot Foil Stamping", label: "Silver Hot Foil Stamping", description: "Brilliant silver chrome foil" },
  { value: "Blind Embossing / Debossing", label: "Blind Embossing / Debossing", description: "Raised 3D relief without ink" },
];

const DEFAULT_SIZE_PRESETS: LookupPresetItem[] = [
  { value: "hangtag_50x90", label: "Hangtag 50×90 mm", description: "Standard clothing retail tag", badge: "Retail", width: 50, height: 90, category: "Hangtag" },
  { value: "card_85x55", label: "Business Card 85×55 mm", description: "Standard ISO business card", badge: "Card", width: 85, height: 55, category: "Card" },
  { value: "label_30x70", label: "Care Label 30×70 mm", description: "Apparel satin wash care label", badge: "Textile", width: 30, height: 70, category: "Label" },
  { value: "sticker_50x50", label: "Square Sticker 50×50 mm", description: "Die-cut adhesive label", badge: "Adhesive", width: 50, height: 50, category: "Sticker" },
  { value: "circle_40x40", label: "Round Sticker Ø 40 mm", description: "Circular sealing sticker", badge: "Round", width: 40, height: 40, category: "Sticker" },
  { value: "a6_105x148", label: "Postcard / A6 105×148 mm", description: "Box insert / promotional card", badge: "Paper", width: 105, height: 148, category: "Card" },
  { value: "a5_148x210", label: "Flyer / A5 148×210 mm", description: "Instruction sheet or booklet cover", badge: "Paper", width: 148, height: 210, category: "Card" },
  { value: "ribbon_25x100", label: "Jacquard Ribbon 25×100 mm", description: "Woven branding ribbon", badge: "Woven", width: 25, height: 100, category: "Jacquard Ribbon" },
];

interface LookupStoreState {
  customers: string[];
  sites: SiteOption[];
  formats: ComboboxItem[];
  cornerTypes: ComboboxItem[];
  paperStocks: ComboboxItem[];
  coatings: ComboboxItem[];
  sizePresets: LookupPresetItem[];

  isSyncing: boolean;
  syncError: string | null;

  // Actions for In-Place Lookup additions (Method 2)
  syncWithServer: (companyCode?: string) => Promise<void>;
  addCustomer: (name: string) => void;
  addSite: (site: Partial<SiteOption> & { name: string }) => SiteOption;
  addFormat: (item: string | ComboboxItem) => void;
  addCornerType: (item: string | ComboboxItem) => void;
  addPaperStock: (item: string | ComboboxItem) => void;
  addCoating: (item: string | ComboboxItem) => void;
  addSizePreset: (preset: LookupPresetItem) => void;
  resetToDefaults: () => void;
}

function normalizeItem(input: string | ComboboxItem, defaultBadge = "Custom"): ComboboxItem {
  if (typeof input === "string") {
    return {
      value: input.trim(),
      label: input.trim(),
      badge: defaultBadge,
    };
  }
  return input;
}

export const useLookupStore = create<LookupStoreState>()(
  persist(
    (set, get) => ({
      customers: [...MOCK_CUSTOMERS],
      sites: [...SITE_OPTIONS],
      formats: [...DEFAULT_FORMATS],
      cornerTypes: [...DEFAULT_CORNER_TYPES],
      paperStocks: [...DEFAULT_PAPER_STOCKS],
      coatings: [...DEFAULT_COATINGS],
      sizePresets: [...DEFAULT_SIZE_PRESETS],
      isSyncing: false,
      syncError: null,

      syncWithServer: async (companyCode = "PRINTGOO") => {
        set({ isSyncing: true, syncError: null });
        try {
          const [itemsRes, diesRes] = await Promise.all([
            fetch(`/api/v1/master/items?company=${companyCode}`),
            fetch(`/api/v1/master/printing/dies?company=${companyCode}`),
          ]);

          if (itemsRes.ok) {
            const itemsJson = await itemsRes.json();
            if (itemsJson.success && Array.isArray(itemsJson.data)) {
              const currentStocks = get().paperStocks;
              const newStocks: ComboboxItem[] = [...currentStocks];

              for (const it of itemsJson.data) {
                const label = it.name;
                const exists = newStocks.some(
                  (s) => s.value.toLowerCase() === label.toLowerCase() || s.label.toLowerCase() === label.toLowerCase()
                );
                if (!exists) {
                  newStocks.push({
                    value: label,
                    label,
                    description: it.description || `${it.category} material`,
                    badge: it.category || "DB",
                  });
                }
              }
              set({ paperStocks: newStocks });
            }
          }

          if (diesRes.ok) {
            const diesJson = await diesRes.json();
            if (diesJson.success && Array.isArray(diesJson.data)) {
              const currentPresets = get().sizePresets;
              const newPresets: LookupPresetItem[] = [...currentPresets];

              for (const die of diesJson.data) {
                const val = die.code;
                const exists = newPresets.some((p) => p.value.toLowerCase() === val.toLowerCase());
                if (!exists) {
                  newPresets.push({
                    value: val,
                    label: `${die.name} (${die.widthMm}×${die.heightMm}mm)`,
                    description: die.notes || `Die ${die.shape}`,
                    badge: "Die Tool",
                    width: Number(die.widthMm),
                    height: Number(die.heightMm),
                    category: die.shape,
                  });
                }
              }
              set({ sizePresets: newPresets });
            }
          }

          set({ isSyncing: false });
        } catch (err) {
          set({
            isSyncing: false,
            syncError: err instanceof Error ? err.message : "Sync failed",
          });
        }
      },

      addCustomer: (name: string) => {
        const clean = name.trim();
        if (!clean) return;
        const exists = get().customers.some((c) => c.toLowerCase() === clean.toLowerCase());
        if (!exists) {
          set((state) => ({ customers: [clean, ...state.customers] }));
        }
      },

      addSite: (siteInput) => {
        const cleanName = siteInput.name.trim();
        const existing = get().sites.find((s) => s.name.toLowerCase() === cleanName.toLowerCase());
        if (existing) return existing;

        const newSite: SiteOption = {
          id: siteInput.id || cleanName,
          name: cleanName,
          label: siteInput.label || `${cleanName} Facility`,
          location: siteInput.location || "Branch Facility",
          facilities: siteInput.facilities || "Manufacturing & Finishing Lines",
          status: siteInput.status || "Active (Online)",
        };

        set((state) => ({ sites: [...state.sites, newSite] }));
        return newSite;
      },

      addFormat: (item) => {
        const norm = normalizeItem(item, "New");
        const exists = get().formats.some((f) => f.value.toLowerCase() === norm.value.toLowerCase());
        if (!exists) {
          set((state) => ({ formats: [...state.formats, norm] }));
        }
      },

      addCornerType: (item) => {
        const norm = normalizeItem(item, "New");
        const exists = get().cornerTypes.some((c) => c.value.toLowerCase() === norm.value.toLowerCase());
        if (!exists) {
          set((state) => ({ cornerTypes: [...state.cornerTypes, norm] }));
        }
      },

      addPaperStock: (item) => {
        const norm = normalizeItem(item, "Custom Stock");
        const exists = get().paperStocks.some((p) => p.value.toLowerCase() === norm.value.toLowerCase());
        if (!exists) {
          set((state) => ({ paperStocks: [...state.paperStocks, norm] }));
        }
      },

      addCoating: (item) => {
        const norm = normalizeItem(item, "Custom Finish");
        const exists = get().coatings.some((c) => c.value.toLowerCase() === norm.value.toLowerCase());
        if (!exists) {
          set((state) => ({ coatings: [...state.coatings, norm] }));
        }
      },

      addSizePreset: (preset) => {
        const cleanVal = preset.value.trim();
        const exists = get().sizePresets.some((s) => s.value.toLowerCase() === cleanVal.toLowerCase());
        if (!exists) {
          set((state) => ({ sizePresets: [...state.sizePresets, preset] }));
        }
      },

      resetToDefaults: () => {
        set({
          customers: [...MOCK_CUSTOMERS],
          sites: [...SITE_OPTIONS],
          formats: [...DEFAULT_FORMATS],
          cornerTypes: [...DEFAULT_CORNER_TYPES],
          paperStocks: [...DEFAULT_PAPER_STOCKS],
          coatings: [...DEFAULT_COATINGS],
          sizePresets: [...DEFAULT_SIZE_PRESETS],
        });
      },
    }),
    {
      name: "printgo_shared_lookups_v1",
    }
  )
);
