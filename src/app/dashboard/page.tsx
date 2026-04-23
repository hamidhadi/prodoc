import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Canvas } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateCanvasDialog } from "@/components/create-canvas-dialog";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const member = await prisma.member.findFirst({
    where: { userId: user.id },
    include: {
      workspace: {
        include: { canvases: { orderBy: { updatedAt: "desc" } } },
      },
    },
  });

  const canvases = member?.workspace.canvases ?? [];
  const workspaceName = member?.workspace.name ?? "Your Workspace";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-lg">{workspaceName}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" formAction="/api/auth/signout">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">Canvases</h2>
          <CreateCanvasDialog />
        </div>

        {canvases.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="mb-4">No canvases yet.</p>
            <CreateCanvasDialog />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {canvases.map((canvas: Canvas) => (
              <Link key={canvas.id} href={`/canvas/${canvas.id}`}>
                <Card className="hover:border-foreground/30 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-base">{canvas.name}</CardTitle>
                    {canvas.description && (
                      <CardDescription>{canvas.description}</CardDescription>
                    )}
                    <p className="text-xs text-muted-foreground pt-1">
                      {new Date(canvas.updatedAt).toLocaleDateString()}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
