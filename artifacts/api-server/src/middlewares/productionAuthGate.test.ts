import assert from "node:assert/strict";

const { ANONYMOUS_FALLBACK_PREFIXES, createProductionAuthGate } = await import(
  "./productionAuthGate.js"
);

type GateResult = {
  status: number | null;
  body: unknown;
  nexted: boolean;
};

function runGate(
  env: { NODE_ENV?: string | undefined },
  user: { id: string } | undefined,
): GateResult {
  const gate = createProductionAuthGate(env);
  const result: GateResult = { status: null, body: null, nexted: false };

  const req: any = { user };
  const res: any = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(payload: unknown) {
      result.body = payload;
      return this;
    },
  };

  gate(req, res, () => {
    result.nexted = true;
  });

  return result;
}

// Produzione + non autenticato → 401, la richiesta non prosegue
{
  const result = runGate({ NODE_ENV: "production" }, undefined);
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "Autenticazione richiesta" });
  assert.equal(result.nexted, false);
}

// Produzione + autenticato → passa
{
  const result = runGate({ NODE_ENV: "production" }, { id: "user-1" });
  assert.equal(result.status, null);
  assert.equal(result.nexted, true);
}

// Sviluppo + non autenticato → passa (fallback anonimo consentito in locale)
{
  const result = runGate({ NODE_ENV: "development" }, undefined);
  assert.equal(result.status, null);
  assert.equal(result.nexted, true);
}

// NODE_ENV assente → trattato come non-produzione
{
  const result = runGate({}, undefined);
  assert.equal(result.status, null);
  assert.equal(result.nexted, true);
}

// I prefissi coprono tutte le rotte note col fallback anonimo
assert.deepEqual(
  [...ANONYMOUS_FALLBACK_PREFIXES].sort(),
  [
    "/backtest",
    "/checkins",
    "/checklist",
    "/ideas",
    "/journal",
    "/mission-templates",
    "/missions",
    "/profile",
    "/push",
    "/quotes",
    "/settings",
  ],
);

console.log("productionAuthGate tests passed");
