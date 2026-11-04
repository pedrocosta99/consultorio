/** localStorage com try/catch: pode falhar em janela privada ou com dados bloqueados. */
export function lerPreferencia<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto == null ? padrao : (JSON.parse(bruto) as T);
  } catch {
    return padrao;
  }
}

export function gravarPreferencia<T>(chave: string, valor: T): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem persistência — segue em memória */
  }
}
