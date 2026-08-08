// ─── ROLES ────────────────────────────────────────────────────────────────────
export type AppRole = "admin" | "head_chef" | "sub_chefe" | "cozinheiro" | "user";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  head_chef: "Head Chef",
  sub_chefe: "Sub-Chefe",
  cozinheiro: "Cozinheiro",
  user: "Utilizador",
};

// ─── ROUTE PERMISSIONS ────────────────────────────────────────────────────────
// Each route lists the minimum roles that can access it.
// Admin always has access to everything.
export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/ingredientes": ["admin", "head_chef", "sub_chefe"],
  "/ingredientes/:id": ["admin", "head_chef", "sub_chefe"],
  "/fornecedores": ["admin", "head_chef"],
  "/rendimento": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/receitas": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/receitas/:id": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/fichas": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/fichas/:id": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/vendas": ["admin", "head_chef", "sub_chefe"],
  "/movimentos-manual": ["admin", "head_chef", "sub_chefe"],
  "/movimentos": ["admin", "head_chef", "sub_chefe"],
  "/inventario": ["admin", "head_chef", "sub_chefe"],
  "/alertas": ["admin", "head_chef", "sub_chefe"],
  "/ocr/faturas": ["admin", "head_chef"],
  "/ocr/fecho-caixa": ["admin", "head_chef", "sub_chefe"],
  "/utilizadores": ["admin", "head_chef"],
  "/etiquetas": ["admin", "head_chef"],
};

// ─── NAV ITEMS PERMISSIONS ────────────────────────────────────────────────────
export const NAV_PERMISSIONS: Record<string, AppRole[]> = {
  "/": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/ingredientes": ["admin", "head_chef", "sub_chefe"],
  "/fornecedores": ["admin", "head_chef"],
  "/rendimento": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/receitas": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/fichas": ["admin", "head_chef", "sub_chefe", "cozinheiro"],
  "/vendas": ["admin", "head_chef", "sub_chefe"],
  "/movimentos-manual": ["admin", "head_chef", "sub_chefe"],
  "/movimentos": ["admin", "head_chef", "sub_chefe"],
  "/inventario": ["admin", "head_chef", "sub_chefe"],
  "/alertas": ["admin", "head_chef", "sub_chefe"],
  "/ocr/faturas": ["admin", "head_chef"],
  "/ocr/fecho-caixa": ["admin", "head_chef", "sub_chefe"],
  "/utilizadores": ["admin", "head_chef"],
  "/etiquetas": ["admin", "head_chef"],
};

export function canAccess(role: AppRole | undefined | null, path: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  const allowed = ROUTE_PERMISSIONS[path];
  if (!allowed) return false;
  return allowed.includes(role);
}
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acesso total — gestão de utilizadores, configurações, todos os módulos",
  head_chef: "Acesso geral à plataforma — todos os módulos incluindo gestão de utilizadores (não pode alterar o perfil do Administrador)",
  sub_chefe: "Acesso geral — incluindo alertas e encomendas; sem OCR de faturas e sem gestão de utilizadores",
  cozinheiro: "Acesso limitado — Fichas Técnicas, Receitas Base e Rendimento de Proteínas",
};
