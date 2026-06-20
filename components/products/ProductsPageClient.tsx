"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Loader2,
  ArrowUpDown,
  Check,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { parseProductCsv } from "@/lib/productParser";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  upsertProductsFromCsv,
} from "@/lib/products";
import type { BotongProduct, ProductFormData } from "@/types/products";

type SortMode = "stock" | "name";

const EMPTY_FORM: ProductFormData = {
  product_name: "",
  option_name: "",
  selling_price: 0,
  cost_price: 0,
  stock_qty: 0,
  safety_stock: 0,
  category: "",
  image_url: "",
  is_active: true,
  sku: "",
};

function formatKrw(n: number): string {
  return n.toLocaleString("ko-KR");
}

function productToForm(p: BotongProduct): ProductFormData {
  return {
    product_name: p.product_name,
    option_name: p.option_name,
    selling_price: p.selling_price,
    cost_price: p.cost_price,
    stock_qty: p.stock_qty,
    safety_stock: p.safety_stock,
    category: p.category ?? "",
    image_url: p.image_url ?? "",
    is_active: p.is_active,
    sku: p.sku ?? "",
  };
}

export default function ProductsPageClient() {
  const [products, setProducts] = useState<BotongProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("stock");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BotongProduct | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{
    id: string;
    field: "cost_price" | "safety_stock";
  } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const data = await getProducts();
    setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (q) {
      list = list.filter((p) => p.product_name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortMode === "stock") {
        return a.stock_qty - b.stock_qty || a.product_name.localeCompare(b.product_name, "ko");
      }
      return a.product_name.localeCompare(b.product_name, "ko");
    });
  }, [products, search, sortMode]);

  const handleCsvUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const text = await file.text();
      const { rows, errors: parseErrors } = parseProductCsv(text);

      if (rows.length === 0 && parseErrors.length > 0) {
        setUploadResult(`오류: ${parseErrors.join(" / ")}`);
        return;
      }

      const result = await upsertProductsFromCsv(rows);
      const allErrors = [...parseErrors, ...result.errorMessages];
      setUploadResult(
        `신규 ${result.inserted}건 / 업데이트 ${result.updated}건 / 오류 ${result.errors + parseErrors.length}건` +
          (allErrors.length > 0 ? `\n${allErrors.slice(0, 5).join("\n")}` : "")
      );
      await loadProducts();
    } catch (e) {
      setUploadResult(`업로드 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (product: BotongProduct) => {
    setEditingProduct(product);
    setForm(productToForm(product));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_name.trim()) {
      setFormError("상품명을 입력해주세요.");
      return;
    }
    setSaving(true);
    setFormError(null);

    if (editingProduct) {
      const { error } = await updateProduct(editingProduct.id, {
        product_name: form.product_name.trim(),
        option_name: form.option_name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        image_url: form.image_url.trim() || null,
        selling_price: form.selling_price,
        cost_price: form.cost_price,
        stock_qty: form.stock_qty,
        safety_stock: form.safety_stock,
        is_active: form.is_active,
      });
      if (error) {
        setFormError(error);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await createProduct(form);
      if (error) {
        setFormError(error);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeModal();
    await loadProducts();
  };

  const handleDelete = async (product: BotongProduct) => {
    if (!confirm(`'${product.product_name}' 상품을 삭제하시겠습니까?`)) return;
    const { error } = await deleteProduct(product.id);
    if (error) {
      alert(`삭제 실패: ${error}`);
      return;
    }
    await loadProducts();
  };

  const startInlineEdit = (
    product: BotongProduct,
    field: "cost_price" | "safety_stock"
  ) => {
    setEditingField({ id: product.id, field });
    setInlineValue(String(product[field]));
  };

  const saveInlineEdit = async () => {
    if (!editingField) return;
    const value = Number(inlineValue.replace(/,/g, ""));
    if (!Number.isFinite(value) || value < 0) {
      setEditingField(null);
      return;
    }
    const { error } = await updateProduct(editingField.id, {
      [editingField.field]: value,
    });
    if (error) {
      alert(`저장 실패: ${error}`);
    } else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingField.id ? { ...p, [editingField.field]: value } : p
        )
      );
    }
    setEditingField(null);
  };

  const toggleSort = () => {
    setSortMode((m) => (m === "stock" ? "name" : "stock"));
  };

  return (
    <>
      <Header title="상품 관리" subtitle="스마트스토어 상품 마스터" />
      <div className="px-6 py-8 md:px-8">
        <PageHeader
          title="상품 관리"
          description="CSV 업로드 또는 직접 등록으로 상품을 관리하세요"
          actions={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvUpload(file);
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={uploading ? Loader2 : Upload}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={uploading ? "[&_svg]:animate-spin" : ""}
              >
                상품 CSV 업로드
              </Button>
              <Button variant="primary" size="sm" icon={Plus} onClick={openAddModal}>
                상품 직접 추가
              </Button>
            </>
          }
        />

        {uploadResult && (
          <div
            className={clsx(
              "mb-6 rounded-xl border px-4 py-3 text-sm whitespace-pre-line",
              uploadResult.includes("오류") && !uploadResult.startsWith("신규")
                ? "border-red-100 bg-red-50 text-red-700"
                : "border-emerald-100 bg-emerald-50 text-emerald-800"
            )}
          >
            {uploadResult}
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
            <Search className="h-4 w-4 flex-shrink-0" />
            <input
              type="text"
              placeholder="상품명 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-w-[160px] bg-transparent text-gray-700 outline-none placeholder:text-gray-300 sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={toggleSort}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortMode === "stock" ? "재고 적은 순" : "이름순"}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400">
              {products.length === 0
                ? "등록된 상품이 없습니다. CSV를 업로드하거나 직접 추가해주세요."
                : "검색 결과가 없습니다."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] table-fixed">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="w-16 px-4 py-3 text-left text-xs font-medium text-gray-400">
                      이미지
                    </th>
                    <th className="w-[220px] px-4 py-3 text-left text-xs font-medium text-gray-400">
                      상품명
                    </th>
                    <th className="w-[140px] px-4 py-3 text-left text-xs font-medium text-gray-400">
                      카테고리
                    </th>
                    <th className="w-28 whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-gray-400">
                      판매가
                    </th>
                    <th className="w-28 whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-gray-400">
                      원가
                    </th>
                    <th className="w-20 whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-gray-400">
                      재고
                    </th>
                    <th className="w-24 whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-gray-400">
                      안전재고
                    </th>
                    <th className="w-24 whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-gray-400">
                      판매상태
                    </th>
                    <th className="w-28 px-4 py-3 text-center text-xs font-medium text-gray-400">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const lowStock = product.stock_qty <= product.safety_stock;
                    return (
                      <tr
                        key={product.id}
                        className={clsx(
                          "border-b border-gray-100 transition-colors hover:bg-gray-50/70",
                          lowStock && "bg-orange-50/60 hover:bg-orange-50"
                        )}
                      >
                        <td className="px-4 py-3">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt=""
                              className="h-10 w-10 rounded-lg border border-gray-100 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-300">
                              —
                            </div>
                          )}
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <p
                            className={clsx(
                              "truncate text-sm font-medium",
                              lowStock ? "text-orange-800" : "text-gray-800"
                            )}
                            title={product.product_name}
                          >
                            {product.product_name}
                          </p>
                          {product.sku && (
                            <p className="mt-0.5 truncate text-[10px] text-gray-400" title={product.sku}>
                              SKU {product.sku}
                            </p>
                          )}
                        </td>
                        <td
                          className="max-w-[140px] truncate px-4 py-3 text-xs text-gray-500"
                          title={product.category || undefined}
                        >
                          {product.category || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-800">
                          {formatKrw(product.selling_price)}원
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {editingField?.id === product.id &&
                          editingField.field === "cost_price" ? (
                            <input
                              type="text"
                              value={inlineValue}
                              onChange={(e) => setInlineValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveInlineEdit();
                                if (e.key === "Escape") setEditingField(null);
                              }}
                              autoFocus
                              className="w-24 rounded-lg border border-[#5b6af4] px-2 py-1 text-right text-sm outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startInlineEdit(product, "cost_price")}
                              className="whitespace-nowrap text-sm tabular-nums text-gray-700 hover:text-[#5b6af4]"
                              title="클릭하여 수정"
                            >
                              {formatKrw(product.cost_price)}원
                            </button>
                          )}
                        </td>
                        <td
                          className={clsx(
                            "whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums",
                            lowStock ? "font-semibold text-orange-600" : "text-gray-700"
                          )}
                        >
                          {formatKrw(product.stock_qty)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {editingField?.id === product.id &&
                          editingField.field === "safety_stock" ? (
                            <input
                              type="text"
                              value={inlineValue}
                              onChange={(e) => setInlineValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveInlineEdit();
                                if (e.key === "Escape") setEditingField(null);
                              }}
                              autoFocus
                              className="w-20 rounded-lg border border-[#5b6af4] px-2 py-1 text-right text-sm outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startInlineEdit(product, "safety_stock")}
                              className="whitespace-nowrap text-sm tabular-nums text-gray-700 hover:text-[#5b6af4]"
                              title="클릭하여 수정"
                            >
                              {formatKrw(product.safety_stock)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={clsx(
                              "inline-block rounded-lg px-2.5 py-1 text-xs font-medium",
                              product.is_active
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-gray-100 text-gray-500"
                            )}
                          >
                            {product.is_active ? "판매중" : "판매중지"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Edit2}
                              onClick={() => openEditModal(product)}
                            >
                              수정
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              className="hover:bg-red-50 hover:text-red-500"
                              onClick={() => handleDelete(product)}
                            >
                              삭제
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400">
              {filtered.length}개 상품
              {search && ` (전체 ${products.length}개 중)`}
            </div>
          )}
        </div>

        {lowStockCount(products) > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-orange-600">
            <AlertCircle className="h-3.5 w-3.5" />
            재고 부족 상품 {lowStockCount(products)}건 (재고 ≤ 안전재고)
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {editingProduct ? "상품 수정" : "상품 직접 추가"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-4 px-6 py-5">
              <FormField label="상품명 *">
                <input
                  value={form.product_name}
                  onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                  className="form-input"
                  required
                />
              </FormField>
              <FormField label="옵션">
                <input
                  value={form.option_name}
                  onChange={(e) => setForm({ ...form, option_name: e.target.value })}
                  className="form-input"
                  placeholder="없으면 비워두세요"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="판매가">
                  <input
                    type="number"
                    min={0}
                    value={form.selling_price}
                    onChange={(e) =>
                      setForm({ ...form, selling_price: Number(e.target.value) })
                    }
                    className="form-input"
                  />
                </FormField>
                <FormField label="원가">
                  <input
                    type="number"
                    min={0}
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: Number(e.target.value) })
                    }
                    className="form-input"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="재고">
                  <input
                    type="number"
                    min={0}
                    value={form.stock_qty}
                    onChange={(e) =>
                      setForm({ ...form, stock_qty: Number(e.target.value) })
                    }
                    className="form-input"
                  />
                </FormField>
                <FormField label="안전재고">
                  <input
                    type="number"
                    min={0}
                    value={form.safety_stock}
                    onChange={(e) =>
                      setForm({ ...form, safety_stock: Number(e.target.value) })
                    }
                    className="form-input"
                  />
                </FormField>
              </div>
              <FormField label="카테고리">
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="form-input"
                  placeholder="예: 생활/건강 > 주방용품"
                />
              </FormField>
              <FormField label="SKU">
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="form-input"
                />
              </FormField>
              <FormField label="이미지 URL">
                <input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="form-input"
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                판매중
              </label>
              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={closeModal}>
                  취소
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  icon={saving ? Loader2 : Check}
                  disabled={saving}
                  className={saving ? "[&_svg]:animate-spin" : ""}
                >
                  {editingProduct ? "저장" : "등록"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e5e7eb;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #374151;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          border-color: #5b6af4;
        }
      `}</style>
    </>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function lowStockCount(products: BotongProduct[]): number {
  return products.filter((p) => p.stock_qty <= p.safety_stock).length;
}
