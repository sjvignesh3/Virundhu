import { Placeholder } from "@/components/owner/placeholder";

export default function QrPage() {
  return (
    <Placeholder
      title="QR Codes"
      description="Generate & download the QR that customers scan to open your menu."
      bullets={[
        "One master QR + per-table QRs",
        "PNG + printable A4 poster",
        "Custom branded frame",
      ]}
    />
  );
}
