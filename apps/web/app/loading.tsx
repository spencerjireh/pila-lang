import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-5/6" />
    </main>
  );
}
