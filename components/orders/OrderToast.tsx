"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import clsx from "clsx";

interface OrderToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export default function OrderToast({ message, type, onClose }: OrderToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={clsx(
        "fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg",
        type === "success"
          ? "bg-emerald-600 text-white"
          : "bg-red-500 text-white"
      )}
      role="status"
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
}
