export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}
