"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import TransactionForm from "@/components/TransactionForm";
import type { AssetTransaction } from "@/types/transactions";

export default function NewTransactionPage() {
  const router = useRouter();

  function handleSuccess(tx: AssetTransaction) {
    router.push("/transactions");
  }

  return (
    <>
      <Header title="Transactions" subtitle="신규 거래 입력" />
      <div className="px-6 py-8 max-w-2xl space-y-6">
        <PageHeader
          title="신규 거래 입력"
          description="매수·매도 거래를 직접 입력하고 Supabase에 저장합니다"
          actions={
            <button
              onClick={() => router.push("/transactions")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              거래 목록
            </button>
          }
        />

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <TransactionForm
            onSuccess={handleSuccess}
            onCancel={() => router.push("/transactions")}
          />
        </div>
      </div>
    </>
  );
}
