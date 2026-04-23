"use client";

import { Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const buttonVariants = [
  "default",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const;
const buttonSizes = ["default", "sm", "lg", "icon"] as const;

export function ComponentsSection() {
  return (
    <section className="space-y-12">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          08 · Components
        </p>
        <h2 className="font-display text-3xl font-semibold text-foreground">
          shadcn primitives, in use
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Every primitive the product ships today, at every CVA variant.
          Internal colors still reference literal slate — token migration is a
          follow-up wave.
        </p>
      </header>

      <Group label="Button · variant × size matrix">
        <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] items-center gap-4">
          <div />
          {buttonSizes.map((size) => (
            <div key={size} className="font-mono text-xs text-muted-foreground">
              {size}
            </div>
          ))}
          {buttonVariants.map((variant) => (
            <ButtonRow key={variant} variant={variant} />
          ))}
        </div>
      </Group>

      <Group label="Badge · variants">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="success">success</Badge>
          <Badge variant="warning">warning</Badge>
          <Badge variant="destructive">destructive</Badge>
          <Badge variant="outline">outline</Badge>
        </div>
      </Group>

      <Group label="Card">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Party of four</CardTitle>
            <CardDescription>Seated at 7:42pm · window table</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              We’ll hold the table for ten minutes. Bring your whole party to
              the host stand when you arrive.
            </p>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="outline" size="sm">
              Message host
            </Button>
            <Button size="sm">Confirm arrival</Button>
          </CardFooter>
        </Card>
      </Group>

      <Group label="Alert · variants">
        <div className="space-y-4">
          <Alert>
            <AlertTitle>You’re on the list</AlertTitle>
            <AlertDescription>
              We’ll text you when your table is ready.
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Longer wait than usual</AlertTitle>
            <AlertDescription>
              Parties ahead of you are larger. Estimated wait is 40 minutes.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Couldn’t hold your table</AlertTitle>
            <AlertDescription>
              Sorry — we gave your table away after fifteen minutes. Rejoin the
              queue when you’re nearby.
            </AlertDescription>
          </Alert>
        </div>
      </Group>

      <Group label="Form · Input, Label, Textarea">
        <form className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ds-name">Your name</Label>
            <Input id="ds-name" placeholder="Isabela" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-party">Party size</Label>
            <Input
              id="ds-party"
              type="number"
              min={1}
              max={12}
              placeholder="2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-notes">Any notes?</Label>
            <Textarea
              id="ds-notes"
              placeholder="Celebrating a birthday, allergic to peanuts, etc."
            />
          </div>
        </form>
      </Group>

      <Group label="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave the queue?</DialogTitle>
              <DialogDescription>
                You’ll lose your spot. We can’t hold it if you rejoin later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Stay in queue</Button>
              <Button variant="destructive">Leave queue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Group>
    </section>
  );
}

function ButtonRow({ variant }: { variant: (typeof buttonVariants)[number] }) {
  return (
    <>
      <div className="font-mono text-xs text-muted-foreground">{variant}</div>
      {buttonSizes.map((size) => (
        <div key={size}>
          <Button variant={variant} size={size}>
            {size === "icon" ? <Plus className="h-4 w-4" /> : "Join queue"}
          </Button>
        </div>
      ))}
    </>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="border-l border-border pl-6">{children}</div>
    </div>
  );
}
