import { describe, expect, it } from "vitest";
import {
  constantTimeStringEqual,
  createSessionToken,
  verifySessionToken,
} from "../src/worker/auth.ts";

describe("auth (HMAC session & constant-time compare)", () => {
  const secret = "segredo-super-forte-para-testes-unitarios-123456";

  it("compara strings corretamente em tempo constante", async () => {
    expect(await constantTimeStringEqual("minha-senha", "minha-senha")).toBe(
      true
    );
    expect(await constantTimeStringEqual("minha-senha", "outra-senha")).toBe(
      false
    );
    expect(await constantTimeStringEqual("curta", "bem-mais-longa")).toBe(false);
  });

  it("cria e valida token de sessão assinado", async () => {
    const now = Date.parse("2026-11-23T20:00:00.000Z");
    const token = await createSessionToken(secret, now);

    expect(await verifySessionToken(token, secret, now + 1000)).toBe(true);
    expect(await verifySessionToken(token, "outro-segredo", now + 1000)).toBe(
      false
    );
    expect(await verifySessionToken(`${token}tampered`, secret, now + 1000)).toBe(
      false
    );
  });

  it("rejeita token expirado", async () => {
    const now = Date.parse("2026-11-23T20:00:00.000Z");
    const token = await createSessionToken(secret, now);
    const after31Days = now + 31 * 24 * 60 * 60 * 1000;

    expect(await verifySessionToken(token, secret, after31Days)).toBe(false);
  });
});
