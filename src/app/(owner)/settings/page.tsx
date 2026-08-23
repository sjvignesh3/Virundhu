import { Placeholder } from "@/components/owner/placeholder";

export default function SettingsPage() {
  return (
    <Placeholder
      title="Settings"
      description="Cart profile, hours, taxes, payment, and staff."
      bullets={[
        "Business hours & holidays",
        "GST / tax configuration",
        "Payment gateway keys",
        "Staff roles & permissions",
      ]}
    />
  );
}
