"use client";

import SaleInputModal from "./SaleInputModal";
import type { FleaMarketItem, FleaMarketSale } from "@/lib/btmFleaMarket";

interface EditSaleModalProps {
  sale: FleaMarketSale;
  items: FleaMarketItem[];
  onConfirm: (itemName: string, price: number, isCard: boolean) => void;
  onClose: () => void;
}

export default function EditSaleModal({ sale, items, onConfirm, onClose }: EditSaleModalProps) {
  return (
    <SaleInputModal
      items={items}
      onConfirm={onConfirm}
      onClose={onClose}
      initialName={sale.item_name}
      initialPrice={sale.price}
      initialIsCard={sale.is_card}
      title="판매 정정"
    />
  );
}
