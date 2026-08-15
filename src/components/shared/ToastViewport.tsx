import { useToastStore } from "@/stores/toast";

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-10 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="ww-toast pointer-events-auto rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
