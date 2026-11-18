"use client";

import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore, type CompanyRecord } from "@/store/workspaceStore";
import { normalizeProductiveTimePercent } from "./operationCost";

/** The company whose settings drive costing: the active one, else the default company, else the first. */
function costingCompany(companies: CompanyRecord[], activeCompanyId: string): CompanyRecord | undefined {
  if (activeCompanyId && activeCompanyId !== "ALL") {
    const active = companies.find((c) => c.id === activeCompanyId || c.code === activeCompanyId);
    if (active) return active;
  }
  return companies.find((c) => c.code === "PRINTGOO") || companies[0];
}

/** Productive-time percent from the company card (Tashkilotlar), loading companies when needed. */
export function useProductiveTimePercent(): number {
  const { companiesList, activeCompanyId } = useWorkspaceStore(
    useShallow((s) => ({ companiesList: s.companiesList, activeCompanyId: s.activeCompanyId }))
  );
  React.useEffect(() => {
    const st = useWorkspaceStore.getState();
    if (st.companiesList.length === 0) void st.loadCompanies();
  }, []);
  return normalizeProductiveTimePercent(costingCompany(companiesList, activeCompanyId)?.settings?.productiveTimePercent);
}

/** Same value outside React (event handlers): read straight from the store. */
export function currentProductiveTimePercent(): number {
  const st = useWorkspaceStore.getState();
  return normalizeProductiveTimePercent(costingCompany(st.companiesList, st.activeCompanyId)?.settings?.productiveTimePercent);
}
