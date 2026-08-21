import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Package, Users, FlaskConical, ChefHat, BookOpen,
  ShoppingCart, ClipboardList, TrendingDown, Bell, FileImage, Receipt, ArrowLeftRight,
  Menu, X, LogOut, ChevronRight, ChevronDown, UserCog, QrCode, Link2, ShieldCheck, Radar, Settings
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { NAV_PERMISSIONS, ROLE_LABELS } from "@shared/permissions";
import type { AppRole } from "@shared/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Package;
};

type NavSection = {
  id: string;
  label: string;
  icon: typeof Package;
  items: NavItem[];
};

const DASHBOARD: NavItem = { href: "/", label: "Dashboard", icon: LayoutDashboard };

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "catalogo-producao",
    label: "Catálogo & produção",
    icon: Package,
    items: [
      { href: "/ingredientes", label: "Ingredientes", icon: Package },
      { href: "/fornecedores", label: "Fornecedores", icon: Users },
      { href: "/rendimento", label: "Rendimento de Proteínas", icon: FlaskConical },
      { href: "/receitas", label: "Receitas Base", icon: ChefHat },
      { href: "/fichas", label: "Fichas Técnicas", icon: BookOpen },
    ],
  },
  {
    id: "stock-movimentos",
    label: "Stock & movimentos",
    icon: ArrowLeftRight,
    items: [
      { href: "/movimentos-manual", label: "Entradas / Saídas", icon: ArrowLeftRight },
      { href: "/movimentos", label: "Livro de Movimentos", icon: ClipboardList },
      { href: "/inventario", label: "Inventário", icon: TrendingDown },
      { href: "/alertas", label: "Alertas e Encomendas", icon: Bell },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: ShoppingCart,
    items: [
      { href: "/vendas", label: "Registo de Vendas", icon: ShoppingCart },
      { href: "/mapa-pos", label: "Mapa POS", icon: Link2 },
    ],
  },
  {
    id: "automacao-ocr",
    label: "Automação OCR",
    icon: FileImage,
    items: [
      { href: "/ocr/faturas", label: "Leitor de Faturas", icon: FileImage },
      { href: "/ocr/fecho-caixa", label: "OCR — Fecho de Caixa", icon: Receipt },
    ],
  },
  {
    id: "administracao-sistema",
    label: "Administração & sistema",
    icon: Settings,
    items: [
      { href: "/aprovacoes", label: "Aprovações", icon: ShieldCheck },
      { href: "/supervisao", label: "Supervisão", icon: Radar },
      { href: "/etiquetas", label: "QR Codes e Etiquetas", icon: QrCode },
      { href: "/utilizadores", label: "Utilizadores", icon: UserCog },
    ],
  },
];

const STORAGE_KEY = "kb-kitchen:menu-secao-aberta";

export function itemEstaAtivo(href: string, location: string) {
  return href === "/" ? location === "/" : location.startsWith(href);
}

export function obterSecaoAtiva(location: string, secoes: NavSection[] = NAV_SECTIONS) {
  return secoes.find((secao) => secao.items.some((item) => itemEstaAtivo(item.href, location)))?.id;
}

function podeVerItem(item: NavItem, role: AppRole) {
  const allowed = NAV_PERMISSIONS[item.href];
  return Boolean(allowed) && (role === "admin" || allowed.includes(role));
}

function formatarBadge(total: number) {
  return total > 99 ? "99+" : String(total);
}

export default function EconomatoLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const role = (user?.role ?? "user") as AppRole;
  const [secaoAberta, setSecaoAberta] = useState<string | null>(() => {
    if (typeof window === "undefined") return "catalogo-producao";
    return window.localStorage.getItem(STORAGE_KEY) ?? "catalogo-producao";
  });

  const podeConsultarAprovacoes = role === "admin" || role === "head_chef";
  const { data: alertas } = trpc.alertas.verificar.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: aprovacoesProducao } = trpc.receitas.listarAprovacoesPendentes.useQuery(undefined, {
    enabled: podeConsultarAprovacoes && isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: aprovacoesInventario } = trpc.inventario.listarAprovacoesPendentes.useQuery(undefined, {
    enabled: podeConsultarAprovacoes && isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const secoesVisiveis = useMemo(() => NAV_SECTIONS
    .map((secao) => ({ ...secao, items: secao.items.filter((item) => podeVerItem(item, role)) }))
    .filter((secao) => secao.items.length > 0), [role]);
  const dashboardVisivel = podeVerItem(DASHBOARD, role);
  const secaoAtiva = obterSecaoAtiva(location, secoesVisiveis);
  const badgeAlertas = (alertas?.abaixoMinimo.length ?? 0) + (alertas?.noPontoEncomenda.length ?? 0) + (alertas?.stockNegativo.length ?? 0);
  const badgeAprovacoes = (aprovacoesProducao?.length ?? 0) + (aprovacoesInventario?.length ?? 0);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (secaoAtiva && secaoAtiva !== secaoAberta) {
      setSecaoAberta(secaoAtiva);
      window.localStorage.setItem(STORAGE_KEY, secaoAtiva);
    }
  }, [location, secaoAtiva, secaoAberta]);

  function alternarSecao(id: string) {
    const proxima = secaoAberta === id ? null : id;
    setSecaoAberta(proxima);
    if (proxima) window.localStorage.setItem(STORAGE_KEY, proxima);
    else window.localStorage.removeItem(STORAGE_KEY);
  }

  function badgeDoItem(href: string) {
    if (href === "/alertas") return badgeAlertas;
    if (href === "/aprovacoes") return badgeAprovacoes;
    return 0;
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-center space-y-3"><div className="text-4xl font-display text-gold">KB Kitchen</div><div className="text-muted-foreground text-sm">A carregar…</div></div></div>;
  if (!isAuthenticated) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-center space-y-3"><div className="text-4xl font-display text-gold">KB Kitchen</div><div className="text-muted-foreground text-sm">A redirecionar…</div></div></div>;

  return <div className="flex h-screen overflow-hidden bg-background">
    {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside className={cn("fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-card transition-transform duration-200 ease-snap lg:static lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center justify-between border-b border-border px-5 py-5"><div><h1 className="font-display text-2xl leading-none text-gold">KB Kitchen</h1><p className="mt-0.5 text-xs text-muted-foreground">Gestão de Cozinha</p></div><button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground lg:hidden" aria-label="Fechar navegação"><X className="h-5 w-5" /></button></div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegação principal">
        {dashboardVisivel && <NavLink item={DASHBOARD} ativo={itemEstaAtivo(DASHBOARD.href, location)} onSelecionar={() => setSidebarOpen(false)} />}
        <div className="my-3 border-t border-border/80" />
        <div className="space-y-1.5">{secoesVisiveis.map((secao) => {
          const aberta = secaoAberta === secao.id;
          const ativa = secaoAtiva === secao.id;
          const Icon = secao.icon;
          return <section key={secao.id} className={cn("overflow-hidden rounded-md border transition-colors", ativa ? "border-gold/35 bg-gold/5" : aberta ? "border-border bg-secondary/15" : "border-transparent") }>
            <button type="button" onClick={() => alternarSecao(secao.id)} aria-expanded={aberta} aria-controls={`menu-${secao.id}`} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-secondary", ativa ? "text-gold" : "text-muted-foreground hover:text-foreground") }>
              <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate font-medium">{secao.label}</span>{ativa && !aberta && <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-label="Secção atual" />}{(secao.id === "stock-movimentos" && badgeAlertas > 0 || secao.id === "administracao-sistema" && badgeAprovacoes > 0) && <span className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-primary-foreground">{formatarBadge(secao.id === "stock-movimentos" ? badgeAlertas : badgeAprovacoes)}</span>}<ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", aberta && "rotate-180")} />
            </button>
            {aberta && <div id={`menu-${secao.id}`} className="space-y-0.5 border-t border-border/60 px-1.5 py-1.5">{secao.items.map((item) => <NavLink key={item.href} item={item} ativo={itemEstaAtivo(item.href, location)} badge={badgeDoItem(item.href)} onSelecionar={() => setSidebarOpen(false)} aninhado />)}</div>}
          </section>;
        })}</div>
      </nav>
      <div className="border-t border-border px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-gold">{user?.name?.charAt(0)?.toUpperCase() ?? "U"}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.name ?? "Utilizador"}</p><p className="truncate text-xs text-gold/70">{ROLE_LABELS[role]}</p></div><button onClick={() => logout()} className="text-muted-foreground transition-colors hover:text-foreground" title="Sair" aria-label="Sair"><LogOut className="h-4 w-4" /></button></div></div>
    </aside>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden"><button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground" aria-label="Abrir navegação"><Menu className="h-5 w-5" /></button><span className="font-display text-xl text-gold">KB Kitchen</span></header><main className="flex-1 overflow-y-auto"><div className="p-4 lg:p-6">{children}</div></main></div>
  </div>;
}

function NavLink({ item, ativo, badge = 0, aninhado = false, onSelecionar }: { item: NavItem; ativo: boolean; badge?: number; aninhado?: boolean; onSelecionar: () => void }) {
  const Icon = item.icon;
  return <Link href={item.href}><div onClick={onSelecionar} aria-current={ativo ? "page" : undefined} className={cn("mb-0.5 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150", aninhado && "py-2 pl-5 text-[13px]", ativo ? "border-l-2 border-primary bg-accent pl-[10px] text-gold" : "text-muted-foreground hover:bg-secondary hover:text-foreground") }><Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{badge > 0 && <span className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-primary-foreground">{formatarBadge(badge)}</span>}{ativo && <ChevronRight className="ml-auto h-3 w-3 text-gold" />}</div></Link>;
}
