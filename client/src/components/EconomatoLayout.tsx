import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Package, Users, FlaskConical, ChefHat, BookOpen,
  ShoppingCart, ClipboardList, TrendingDown, Bell, FileImage, Receipt,
  Menu, X, LogOut, ChevronRight
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ingredientes", label: "Ingredientes", icon: Package },
  { href: "/fornecedores", label: "Fornecedores", icon: Users },
  { href: "/rendimento", label: "Rendimento de Proteínas", icon: FlaskConical },
  { href: "/receitas", label: "Receitas Base", icon: ChefHat },
  { href: "/fichas", label: "Fichas Técnicas", icon: BookOpen },
  { href: "/vendas", label: "Registo de Vendas", icon: ShoppingCart },
  { href: "/movimentos", label: "Livro de Movimentos", icon: ClipboardList },
  { href: "/inventario", label: "Inventário", icon: TrendingDown },
  { href: "/alertas", label: "Alertas e Encomendas", icon: Bell },
  { href: "/ocr/faturas", label: "OCR — Faturas", icon: FileImage },
  { href: "/ocr/fecho-caixa", label: "OCR — Fecho de Caixa", icon: Receipt },
];

export default function EconomatoLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="text-4xl font-display text-gold">Economato</div>
          <div className="text-muted-foreground text-sm">A carregar…</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div>
            <h1 className="text-5xl font-display text-gold mb-2">Economato</h1>
            <p className="text-muted-foreground text-sm">Gestão de Stock e Fichas Técnicas</p>
          </div>
          <Button
            onClick={() => startLogin()}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-card border-r border-border transition-transform duration-200 ease-snap lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border">
          <div>
            <h1 className="font-display text-2xl text-gold leading-none">Economato</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Gestão de Stock</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors duration-150 mb-0.5",
                    isActive
                      ? "bg-accent text-gold border-l-2 border-primary pl-[10px]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto text-gold" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-gold text-sm font-medium">
              {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name ?? "Utilizador"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
            <button
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display text-xl text-gold">Economato</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

