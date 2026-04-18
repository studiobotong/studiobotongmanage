"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SeedPortfolioPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/transactions");
  }, [router]);
  return null;
}
