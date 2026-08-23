import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/owner/page-header";
import { Sparkles } from "lucide-react";

type PlaceholderProps = {
  title: string;
  description: string;
  bullets?: string[];
};

export function Placeholder({ title, description, bullets }: PlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={<Badge variant="info">Coming soon</Badge>}
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-medium">This screen is on the way</p>
            <p className="text-sm text-muted-foreground">
              Shell is ready — real functionality lands in the next steps.
            </p>
          </div>
          {bullets && bullets.length > 0 && (
            <ul className="mt-2 space-y-1 text-left text-sm text-muted-foreground">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
