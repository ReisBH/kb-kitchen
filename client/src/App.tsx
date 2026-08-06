import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import EconomatoLayout from "./components/EconomatoLayout";
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

function AppRoutes() {
  return (
    <EconomatoLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/ingredientes" component={Ingredientes} />
        <Route path="/ingredientes/:id" component={IngredienteDetalhe} />
        <Route path="/fornecedores" component={Fornecedores} />
        <Route path="/rendimento" component={Rendimento} />
        <Route path="/receitas" component={ReceitasBase} />
        <Route path="/receitas/:id" component={ReceitaDetalhe} />
        <Route path="/fichas" component={FichasTecnicas} />
        <Route path="/fichas/:id" component={FichaDetalhe} />
        <Route path="/vendas" component={Vendas} />
        <Route path="/inventario" component={Inventario} />
        <Route path="/movimentos" component={Movimentos} />
        <Route path="/alertas" component={Alertas} />
        <Route path="/ocr/faturas" component={OcrFaturas} />
        <Route path="/ocr/fecho-caixa" component={OcrFechoCaixa} />
        <Route path="/movimentos-manual" component={MovimentosManual} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </EconomatoLayout>
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
