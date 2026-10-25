import { ThemeToggle } from "@/components/theme-toggle";
import { SparkIcon } from "@/components/ui/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-fg">
            <SparkIcon width={18} height={18} />
          </span>
          Estudos IA
        </div>
        <ThemeToggle />
      </header>
      <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
