import { Placeholder } from "@/components/owner/placeholder";

export default function PrintersPage() {
  return (
    <Placeholder
      title="Printers"
      description="Configure thermal / bluetooth receipt printers."
      bullets={[
        "Auto-print KOT on new order",
        "Test print",
        "Multi-station routing (kitchen vs counter)",
      ]}
    />
  );
}
