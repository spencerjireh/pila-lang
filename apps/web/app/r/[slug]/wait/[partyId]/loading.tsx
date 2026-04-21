import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center space-y-8 px-6 py-12">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-32" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-10 w-40" />
    </main>
  );
}
