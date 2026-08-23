import { Placeholder } from "@/components/owner/placeholder";

export default function OrderHistoryPage() {
  return (
    <Placeholder
      title="Order History"
      description="Search and filter completed orders."
      bullets={[
        "Date range + status filters",
        "Search by order ID or item",
        "Export as CSV",
        "Refund / void flow",
      ]}
    />
  );
}
