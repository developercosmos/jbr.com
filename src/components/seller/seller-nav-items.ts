import { LayoutDashboard, Package, PackagePlus, ShoppingBag, BarChart3, Store, Tag, Wallet } from "lucide-react";

export interface SellerNavItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
}

/** Single source of truth for the seller navigation (desktop sidebar + mobile drawer). */
export const SELLER_NAV_ITEMS: SellerNavItem[] = [
    { label: "Overview", href: "/seller", icon: LayoutDashboard },
    { label: "PRODUK SAYA", href: "/seller/products", icon: Package },
    { label: "Add Product", href: "/seller/products/add", icon: PackagePlus },
    { label: "Orders", href: "/seller/orders", icon: ShoppingBag },
    { label: "Penawaran", href: "/seller/offers", icon: Tag },
    { label: "Analytics", href: "/seller/analytics", icon: BarChart3 },
    { label: "Keuangan", href: "/seller/keuangan", icon: Wallet },
    { label: "Store Settings", href: "/seller/settings", icon: Store },
];
