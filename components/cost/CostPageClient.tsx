"use client";

import { useState } from "react";
import Header from "@/components/Header";
import CostTable from "./CostTable";
import PurchaseManager from "./PurchaseManager";
import MaterialManager from "./MaterialManager";
import SupplierManager from "./SupplierManager";

const TABS = [
  { id: "cost",      label: "원가표" },
  { id: "purchase",  label: "구매내역" },
  { id: "material",  label: "부자재" },
  { id: "supplier",  label: "거래처" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CostPageClient() {
  const [tab, setTab] = useState<TabId>("cost");

  return (
    <>
      <Header title="원가 관리" subtitle="상품 원가·구매내역·부자재·거래처" />
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* 탭 */}
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-[#5b6af4] text-[#5b6af4]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "cost"     && <CostTable />}
        {tab === "purchase" && <PurchaseManager />}
        {tab === "material" && <MaterialManager />}
        {tab === "supplier" && <SupplierManager />}
      </div>
    </>
  );
}
