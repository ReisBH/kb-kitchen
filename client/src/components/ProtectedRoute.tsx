import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { canAccess } from "@shared/permissions";
import type { AppRole } from "@shared/permissions";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import AcessoNegado from "@/pages/AcessoNegado";

interface ProtectedRouteProps {
  component: React.ComponentType;
  path: string;
}

export default function ProtectedRoute({ component: Component, path }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login
    startLogin();
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const role = (user?.role ?? "user") as AppRole;
  if (!canAccess(role, path)) {
    return <AcessoNegado />;
  }

  return <Component />;
}

