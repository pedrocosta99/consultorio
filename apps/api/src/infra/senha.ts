import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt N=2^15, r=8, p=1 (~32 MB). Formato: scrypt$N$r$p$sal$hash (base64).
const N = 1 << 15;
const R = 8;
const P = 1;
const MAXMEM = 64 * 1024 * 1024;

export function hashSenha(senha: string): string {
  const sal = randomBytes(16);
  const h = scryptSync(senha.normalize("NFC"), sal, 32, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, sal.toString("base64"), h.toString("base64")].join("$");
}

export function conferirSenha(senha: string, guardado: string): boolean {
  const [alg, n, r, p, sal, hash] = guardado.split("$");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const h = scryptSync(senha.normalize("NFC"), Buffer.from(sal, "base64"), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return timingSafeEqual(h, esperado);
}
