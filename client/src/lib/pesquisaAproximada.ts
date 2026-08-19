const normalizar = (texto: string) => texto
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-PT")
  .trim();

function distanciaLevenshtein(a: string, b: string): number {
  const anterior = Array.from({ length: b.length + 1 }, (_, indice) => indice);
  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    for (let j = 1; j <= b.length; j += 1) atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    for (let j = 0; j <= b.length; j += 1) anterior[j] = atual[j];
  }
  return anterior[b.length];
}

/** Aceita acentos, fragmentos e pequenos erros de escrita em nomes portugueses. */
export function correspondePesquisaAproximada(nome: string, pesquisa: string): boolean {
  const consulta = normalizar(pesquisa);
  if (!consulta) return true;
  const alvo = normalizar(nome);
  if (alvo.includes(consulta)) return true;
  const palavrasNome = alvo.split(/\s+/).filter(Boolean);
  return consulta.split(/\s+/).filter(Boolean).every((termo) => palavrasNome.some((palavra) => palavra.startsWith(termo) || distanciaLevenshtein(palavra, termo) <= Math.max(1, Math.ceil(termo.length / 4))));
}
