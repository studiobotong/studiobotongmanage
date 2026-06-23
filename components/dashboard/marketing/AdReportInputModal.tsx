"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import Button from "@/components/Button";
import { parseAdReportExcel } from "@/lib/adReportParser";
import { insertAdReport, uploadAdReports } from "@/lib/adReports";
import type { AdPlatform } from "@/types/adReports";

interface AdReportInputModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FORM = {
  platform: "meta" as AdPlatform,
  campaign_name: "",
  report_date: "",
  spend: "",
  impressions: "",
  clicks: "",
  conversions: "",
  revenue: "",
};

export default function AdReportInputModal({
  open,
  onClose,
  onSaved,
}: AdReportInputModalProps) {
  const [tab, setTab] = useState<"manual" | "upload">("manual");
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadPlatform, setUploadPlatform] = useState<AdPlatform>("meta");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setForm(EMPTY_FORM);
    setMessage(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleManualSave = async () => {
    if (!form.report_date) {
      setError("날짜를 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await insertAdReport({
      platform: form.platform,
      campaign_name: form.campaign_name || undefined,
      report_date: form.report_date,
      spend: Number(form.spend) || 0,
      impressions: Number(form.impressions) || 0,
      clicks: Number(form.clicks) || 0,
      conversions: Number(form.conversions) || 0,
      revenue: Number(form.revenue) || 0,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "저장에 실패했습니다.");
      return;
    }
    setMessage("저장되었습니다.");
    reset();
    onSaved();
    setTimeout(handleClose, 800);
  };

  const handleFileUpload = async (file: File) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const { rows, errors: parseErrors } = parseAdReportExcel(
        buffer,
        uploadPlatform
      );
      if (parseErrors.length > 0 && rows.length === 0) {
        setError(parseErrors.join("\n"));
        setSaving(false);
        return;
      }
      const result = await uploadAdReports(rows);
      setMessage(`등록 ${result.inserted}건, 스킵 ${result.skipped}건`);
      if (result.errors.length > 0) {
        setError(result.errors.join("\n"));
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={handleClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-xl border border-[#E5E7EB] shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-base font-semibold text-gray-800">
            광고 데이터 입력
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-[#E5E7EB]">
          {(["manual", "upload"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium ${
                tab === t
                  ? "text-[#2563EB] border-b-2 border-[#2563EB]"
                  : "text-gray-400"
              }`}
            >
              {t === "manual" ? "수동 입력" : "엑셀 업로드"}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600 whitespace-pre-wrap">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-600">
              {message}
            </div>
          )}

          {tab === "manual" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-500">플랫폼</span>
                  <select
                    value={form.platform}
                    onChange={(e) =>
                      setForm({ ...form, platform: e.target.value as AdPlatform })
                    }
                    className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  >
                    <option value="meta">메타</option>
                    <option value="naver">네이버</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">날짜</span>
                  <input
                    type="date"
                    value={form.report_date}
                    onChange={(e) =>
                      setForm({ ...form, report_date: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-gray-500">캠페인명</span>
                <input
                  type="text"
                  value={form.campaign_name}
                  onChange={(e) =>
                    setForm({ ...form, campaign_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  placeholder="캠페인명"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["spend", "광고비 (원)"],
                    ["impressions", "노출수"],
                    ["clicks", "클릭수"],
                    ["conversions", "전환수"],
                    ["revenue", "기여 매출 (원)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-xs text-gray-500">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
              <Button
                variant="primary"
                onClick={() => void handleManualSave()}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "저장"
                )}
              </Button>
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-xs text-gray-500">플랫폼</span>
                <select
                  value={uploadPlatform}
                  onChange={(e) =>
                    setUploadPlatform(e.target.value as AdPlatform)
                  }
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  <option value="meta">메타 (인스타/페이스북)</option>
                  <option value="naver">네이버</option>
                </select>
              </label>
              <div
                className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-8 text-center cursor-pointer hover:border-[#2563EB]/40 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  광고 리포트 .xlsx 파일을 선택하세요
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  메타: 날짜·캠페인명·노출·클릭·지출·구매·구매전환값
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              {saving && (
                <div className="flex items-center justify-center text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  처리 중…
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
