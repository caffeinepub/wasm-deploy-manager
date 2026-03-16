import { Actor, type HttpAgent } from "@icp-sdk/core/agent";
import type { Principal } from "@icp-sdk/core/principal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const managementIDLFactory = ({ IDL }: { IDL: any }) => {
  return IDL.Service({
    canister_status: IDL.Func(
      [IDL.Record({ canister_id: IDL.Principal })],
      [
        IDL.Record({
          controllers: IDL.Vec(IDL.Principal),
          memory_size: IDL.Nat,
          cycles: IDL.Nat,
          status: IDL.Variant({
            running: IDL.Null,
            stopping: IDL.Null,
            stopped: IDL.Null,
          }),
          freezing_threshold: IDL.Nat,
          idle_cycles_burned_per_day: IDL.Nat,
        }),
      ],
      [],
    ),
    install_code: IDL.Func(
      [
        IDL.Record({
          mode: IDL.Variant({
            install: IDL.Null,
            reinstall: IDL.Null,
            upgrade: IDL.Null,
          }),
          canister_id: IDL.Principal,
          wasm_module: IDL.Vec(IDL.Nat8),
          arg: IDL.Vec(IDL.Nat8),
        }),
      ],
      [],
      [],
    ),
  });
};

type ManagementActor = {
  canister_status: (arg: {
    canister_id: Principal;
  }) => Promise<{ controllers: Principal[] }>;
  install_code: (arg: {
    mode: { install: null } | { reinstall: null } | { upgrade: null };
    canister_id: Principal;
    wasm_module: Uint8Array;
    arg: Uint8Array;
  }) => Promise<void>;
};

export function createManagementActor(agent: HttpAgent): ManagementActor {
  return Actor.createActor(managementIDLFactory as never, {
    agent,
    canisterId: "aaaaa-aa",
  }) as ManagementActor;
}

export async function verifyOwnership(
  agent: HttpAgent,
  canisterId: Principal,
  callerPrincipal: Principal,
): Promise<{ verified: boolean; error?: string }> {
  try {
    const mgmt = createManagementActor(agent);
    const result = await mgmt.canister_status({ canister_id: canisterId });
    const controllers = result.controllers.map((c: Principal) => c.toText());
    const callerText = callerPrincipal.toText();
    const verified = controllers.includes(callerText);
    return { verified };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not a controller") || msg.includes("403")) {
      return {
        verified: false,
        error: "You are not a controller of this canister.",
      };
    }
    return { verified: false, error: msg };
  }
}

export async function installCode(
  agent: HttpAgent,
  canisterId: Principal,
  wasmModule: Uint8Array,
  mode: "install" | "reinstall" | "upgrade",
): Promise<void> {
  const mgmt = createManagementActor(agent);
  await mgmt.install_code({
    mode: { [mode]: null } as
      | { install: null }
      | { reinstall: null }
      | { upgrade: null },
    canister_id: canisterId,
    wasm_module: wasmModule,
    arg: new Uint8Array(),
  });
}

export function createMockWasm(): Uint8Array {
  // Minimal valid WASM module (magic + version)
  return new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
}
