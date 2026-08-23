import { Placeholder } from "@/components/owner/placeholder";

export default function LiveOrdersPage() {
  return (
    <Placeholder
      title="Live Orders"
      description="Kanban board of new → cooking → ready → completed."
      bullets={[
        "Real-time updates via polling / websockets",
        "Sound + toast on new order",
        "One-tap status transitions with undo",
        "Print KOT / receipt directly from card",
      ]}
    />
  );
}
