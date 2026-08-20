import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import EconomatoLayout from "./components/EconomatoLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import AcessoNegado from "./pages/AcessoNegado";
import Dashboard from "./pages/Dashboard";
import Ingredientes from "./pages/Ingredientes";
import IngredienteDetalhe from "./pages/IngredienteDetalhe";
import Fornecedores from "./pages/Fornecedores";
import Rendimento from "./pages/Rendimento";
import ReceitasBase from "./pages/ReceitasBase";
import ReceitaDetalhe from "./pages/ReceitaDetalhe";
import FichasTecnicas from "./pages/FichasTecnicas";
import FichaDetalhe from "./pages/FichaDetalhe";
import Vendas from "./pages/Vendas";
import Inventario from "./pages/Inventario";
import Movimentos from "./pages/Movimentos";
import Alertas from "./pages/Alertas";
import OcrFaturas from "./pages/OcrFaturas";
import OcrFechoCaixa from "./pages/OcrFechoCaixa";
import MovimentosManual from "./pages/MovimentosManual";
import Utilizadores from "./pages/Utilizadores";
import QrSaida from "./pages/QrSaida";
import QrLote from "./pages/QrLote";
import Etiquetas from "./pages/Etiquetas";
import MapaPos from "./pages/MapaPos";
import Aprovacoes from "./pages/Aprovacoes";
import Supervisao from "./pages/Supervisao";

// Helper: wrap a component in EconomatoLayout + ProtectedRoute
function P({ path, component }: { path: string; component: React.ComponentType }) {
  return <EconomatoLayout><ProtectedRoute path={path} component={component} /></EconomatoLayout>;
}

function AppRoutes() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/acesso-negado" component={AcessoNegado} />

      {/* Protected routes — each enforces role via ProtectedRoute */}
      <Route path="/">{() => <P path="/" component={Dashboard} />}</Route>
      <Route path="/ingredientes">{() => <P path="/ingredientes" component={Ingredientes} />}</Route>
      <Route path="/ingredientes/:id">{() => <P path="/ingredientes/:id" component={IngredienteDetalhe} />}</Route>
      <Route path="/fornecedores">{() => <P path="/fornecedores" component={Fornecedores} />}</Route>
      <Route path="/rendimento">{() => <P path="/rendimento" component={Rendimento} />}</Route>
      <Route path="/receitas">{() => <P path="/receitas" component={ReceitasBase} />}</Route>
      <Route path="/receitas/:id">{() => <P path="/receitas/:id" component={ReceitaDetalhe} />}</Route>
      <Route path="/fichas">{() => <P path="/fichas" component={FichasTecnicas} />}</Route>
      <Route path="/fichas/:id">{() => <P path="/fichas/:id" component={FichaDetalhe} />}</Route>
      <Route path="/vendas">{() => <P path="/vendas" component={Vendas} />}</Route>
      <Route path="/movimentos-manual">{() => <P path="/movimentos-manual" component={MovimentosManual} />}</Route>
      <Route path="/movimentos">{() => <P path="/movimentos" component={Movimentos} />}</Route>
      <Route path="/inventario">{() => <P path="/inventario" component={Inventario} />}</Route>
      <Route path="/alertas">{() => <P path="/alertas" component={Alertas} />}</Route>
      <Route path="/ocr/faturas">{() => <P path="/ocr/faturas" component={OcrFaturas} />}</Route>
      <Route path="/ocr/fecho-caixa">{() => <P path="/ocr/fecho-caixa" component={OcrFechoCaixa} />}</Route>
      <Route path="/utilizadores">{() => <P path="/utilizadores" component={Utilizadores} />}</Route>
      <Route path="/s/:codigo" component={QrSaida} />
      <Route path="/l/:codigo" component={QrLote} />
      <Route path="/etiquetas">{() => <P path="/etiquetas" component={Etiquetas} />}</Route>
      <Route path="/mapa-pos">{() => <P path="/mapa-pos" component={MapaPos} />}</Route>
      <Route path="/aprovacoes">{() => <P path="/aprovacoes" component={Aprovacoes} />}</Route>
      <Route path="/supervisao">{() => <P path="/supervisao" component={Supervisao} />}</Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.14 0.008 280)",
                border: "1px solid oklch(0.22 0.010 280)",
                color: "oklch(0.92 0.008 80)",
              },
            }}
          />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
