import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Mail, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

function NovoFornecedorForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, reset } = useForm<any>();
  const utils = trpc.useUtils();
  const criar = trpc.fornecedores.criar.useMutation({
    onSuccess: () => { toast.success("Fornecedor criado"); utils.fornecedores.listar.invalidate(); reset(); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form onSubmit={handleSubmit(d => criar.mutate(d))} className="space-y-3">
      <div><label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
        <Input {...register("nome", { required: true })} className="bg-input border-border" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground mb-1 block">NIF</label>
          <Input {...register("nif")} className="bg-input border-border" /></div>
        <div><label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
          <Input {...register("telefone")} className="bg-input border-border" /></div>
      </div>
      <div><label className="text-xs text-muted-foreground mb-1 block">Email</label>
        <Input {...register("email")} type="email" className="bg-input border-border" /></div>
      <div><label className="text-xs text-muted-foreground mb-1 block">Morada</label>
        <Input {...register("morada")} className="bg-input border-border" /></div>
      <Button type="submit" disabled={criar.isPending} className="w-full bg-primary text-primary-foreground">
        {criar.isPending ? "A criar…" : "Criar Fornecedor"}
      </Button>
    </form>
  );
}

export default function Fornecedores() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = trpc.fornecedores.listar.useQuery();
  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-3xl text-gold">Fornecedores</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.length ?? 0} fornecedores</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" /> Novo Fornecedor</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="font-display text-xl text-gold">Novo Fornecedor</DialogTitle></DialogHeader>
            <NovoFornecedorForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-card rounded animate-pulse" />)}</div>
        : (data?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Ainda não há fornecedores. Cria o primeiro fornecedor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data!.map(f => (
              <Card key={f.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-medium text-gold">{f.nome}</h3>
                  {f.nif && <p className="text-xs text-muted-foreground">NIF: {f.nif}</p>}
                  {f.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-3 h-3" />{f.email}</div>}
                  {f.telefone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-3 h-3" />{f.telefone}</div>}
                  <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${f.ativo ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                    {f.ativo ? "Activo" : "Inactivo"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

