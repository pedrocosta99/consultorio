import { describe, expect, it } from "vitest";
import { lerConfig } from "./config";

describe("config por ambiente", () => {
  it("padrão: loopback na 8787", () => {
    expect(lerConfig({})).toEqual({ host: "127.0.0.1", porta: 8787, web: null, container: false });
  });
  it("Cloud Run: PORT manda", () => {
    expect(lerConfig({ PORT: "8080", API_PORT: "9999", HOST: "0.0.0.0", CONSULTORIO_CONTAINER: "1" })).toMatchObject({ porta: 8080, host: "0.0.0.0" });
  });
  it("fora do container, recusa escutar na rede", () => {
    expect(() => lerConfig({ HOST: "0.0.0.0" })).toThrow(/loopback/);
  });
});
