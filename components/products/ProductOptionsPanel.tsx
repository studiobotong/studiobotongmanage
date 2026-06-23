"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Check } from "lucide-react";
import clsx from "clsx";
import Button from "@/components/Button";
import {
  getProductOptions,
  updateProductOption,
  deleteProductOption,
} from "@/lib/productOptions";
import type { BotongProductOption } from "@/types/productOptions";

type EditableField = "cost_price" | "safety_stock" | "stock_qty";

interface EditState {
  optionId: string;
  field: EditableField;
  value: string;
}

function formatKrw(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function ProductOptionsPanel({
  productId,
}: {
  productId: string;
}) {
  const [options, setOptions] = useState<BotongProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    const data = await getProductOptions(productId);
    setOptions(data);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const startEdit = (option: BotongProductOption, field: EditableField) => {
    setEditState({
      optionId: option.id,
      field,
      value: String(option[field]),
    });
  };

  const saveEdit = async () => {
    if (!editState) return;
    const value = Number(editState.value.replace(/,/g, ""));
    if (!Number.isFinite(value) || value < 0) {
      setEditState(null);
      return;
    }

    setSavingId(editState.optionId);
    const { error } = await updateProductOption(editState.optionId, {
      [editState.field]: value,
    });
    setSavingId(null);

    if (error) {
      alert(`저장 실패: ${error}`);
    } else {
      setOptions((prev) =>
        prev.map((o) =>
          o.id === editState.optionId ? { ...o, [editState.field]: value } : o
        )
      );
    }
    setEditState(null);
  };

  const handleDelete = async (option: BotongProductOption) => {
    if (
      !confirm(
        `옵션 '${option.sku_code}' (${option.option_name})을 삭제하시겠습니까?`
      )
    ) {
      return;
    }

    const { error } = await deleteProductOption(option.id);
    if (error) {
      alert(`삭제 실패: ${error}`);
      return;
    }
    setOptions((prev) => prev.filter((o) => o.id !== option.id));
  };

  const renderEditableCell = (
    option: BotongProductOption,
    field: EditableField,
    suffix = ""
  ) => {
    const isEditing =
      editState?.optionId === option.id && editState.field === field;
    const isSaving = savingId === option.id;

    if (isEditing) {
      return (
        <div className="flex items-center justify-end gap-1">
          <input
            type="text"
            value={editState.value}
            onChange={(e) =>
              setEditState({ ...editState, value: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setEditState(null);
            }}
            autoFocus
            className="w-20 rounded border border-[#5b6af4] px-2 py-0.5 text-right text-xs outline-none"
          />
          <button
            type="button"
            onClick={saveEdit}
            disabled={isSaving}
            className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
            title="저장"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      );
    }

    const displayValue =
      field === "cost_price"
        ? `${formatKrw(option[field])}원`
        : formatKrw(option[field]);

    return (
      <button
        type="button"
        onClick={() => startEdit(option, field)}
        className="text-xs tabular-nums text-gray-700 hover:text-[#5b6af4]"
        title="클릭하여 수정"
      >
        {displayValue}
        {suffix}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-6 py-4 text-xs text-gray-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        옵션 불러오는 중...
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="px-6 py-4 text-xs text-gray-400">
        등록된 옵션이 없습니다. 옵션 Excel을 업로드해주세요.
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
      <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        옵션 목록 ({options.length}개)
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400">
                옵션관리코드
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400">
                옵션정보
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-400">
                원가
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-400">
                현재고
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-400">
                안전재고
              </th>
              <th className="w-16 px-3 py-2 text-center text-[10px] font-medium text-gray-400">
                삭제
              </th>
            </tr>
          </thead>
          <tbody>
            {options.map((option) => {
              const lowStock = option.stock_qty <= option.safety_stock;
              return (
                <tr
                  key={option.id}
                  className={clsx(
                    "border-b border-gray-50 last:border-0",
                    lowStock && "bg-orange-50/40"
                  )}
                >
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">
                    {option.sku_code}
                  </td>
                  <td
                    className="max-w-[200px] truncate px-3 py-2 text-xs text-gray-600"
                    title={option.option_name}
                  >
                    {option.option_name}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {renderEditableCell(option, "cost_price")}
                  </td>
                  <td
                    className={clsx(
                      "px-3 py-2 text-right",
                      lowStock && "font-medium text-orange-600"
                    )}
                  >
                    {renderEditableCell(option, "stock_qty")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {renderEditableCell(option, "safety_stock")}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="hover:bg-red-50 hover:text-red-500"
                      onClick={() => handleDelete(option)}
                    >
                      <span className="sr-only">삭제</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
