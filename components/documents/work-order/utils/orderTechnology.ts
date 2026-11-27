/**
 * The order's production technology: decides which specification cards the order
 * screen shows and which passport profile doc-service prints (job_ticket_profiles.py).
 */
export type OrderTechnology = "offset" | "flexo_sticker" | "flexo_ribbon" | "jacquard" | "termo";

export const TEXTILE_RIBBON_MATERIALS = [
  "polyester_satin_white",
  "polyester_satin_black",
  "nylon_taffeta",
  "cotton_tape",
];

interface TechnologyInputs {
  department?: string | null;
  recipe?: string | null;
  labelMaterialType?: string | null;
  paperStock?: string | null;
}

export function getOrderTechnology({ department, recipe, labelMaterialType, paperStock }: TechnologyInputs): OrderTechnology {
  if (department === "Termo") return "termo";
  if (department === "Flexo" || recipe?.startsWith("FLEXO_")) {
    const stock = (paperStock || "").toLowerCase();
    const ribbon =
      TEXTILE_RIBBON_MATERIALS.includes(labelMaterialType || "") || stock.includes("satin") || stock.includes("nylon");
    return ribbon ? "flexo_ribbon" : "flexo_sticker";
  }
  if (department === "Jacquard" || recipe?.startsWith("JACQ_")) return "jacquard";
  return "offset";
}
