"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@virundhu/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCurrentSession, apiLogin } from "@/lib/api/auth-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("owner@anna.test");
  const [password, setPassword] = React.useState("owner123");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (apiCurrentSession()) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiLogin(email.trim(), password);
      toast.success("Signed in");
      router.replace("/dashboard");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.body.message : (err as Error).message ?? "Login failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-6 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Virundhu</h1>
            <p className="mt-1 text-sm text-muted-foreground">Owner sign-in</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={busy}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link
              href="/signup"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create an owner account
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            Demo owner: <code>owner@anna.test</code> / <code>owner123</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
