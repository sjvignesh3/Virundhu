import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  FolderTree,
  History,
  BarChart3,
  QrCode,
  Printer,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type OwnerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Whether the item should appear in the mobile bottom tab bar. */
  primary?: boolean;
};

export const ownerNav: OwnerNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { href: "/orders/live", label: "Live Orders", icon: ClipboardList, primary: true },
  { href: "/products", label: "Products", icon: UtensilsCrossed, primary: true },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/orders/history", label: "History", icon: History },
  { href: "/reports", label: "Reports", icon: BarChart3, primary: true },
  { href: "/qr", label: "QR Codes", icon: QrCode },
  { href: "/printers", label: "Printers", icon: Printer },
  { href: "/settings", label: "Settings", icon: Settings },
];
