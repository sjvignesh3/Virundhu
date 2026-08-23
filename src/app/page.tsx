import Link from "next/link";
import { ArrowRight, LayoutDashboard, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="container flex min-h-screen flex-col items-center justify-center py-16">
        <div className="mb-10 flex flex-col items-center text-center">
          <Badge variant="warning" className="mb-4">
            Phase 1 · MVP
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            CartSas <span className="text-primary">Food Cart</span> OS
          </h1>
          <p className="mt-4 max-w-xl text-balance text-muted-foreground">
            Take orders, run the kitchen, and understand your business — one QR code away.
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <CardTitle>Owner Dashboard</CardTitle>
              <CardDescription>
                Manage products, run the live board, print QR codes, and view reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/dashboard">
                  Open dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Utensils className="h-5 w-5" />
              </div>
              <CardTitle>Customer Menu</CardTitle>
              <CardDescription>
                Preview the mobile ordering experience for the demo store.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/order/anna-street-food">
                  Try the menu <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Local-only demo · no data leaves your browser
        </p>
      </div>
    </main>
  );
}
