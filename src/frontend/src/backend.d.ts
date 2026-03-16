import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export type OpResult = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: string;
};
export interface WasmEntry {
    wasm: Uint8Array;
    compiledAt: bigint;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addAdmin(principal: Principal): Promise<OpResult>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAdmins(): Promise<Array<Principal>>;
    getCallerUserRole(): Promise<UserRole>;
    getOwner(): Promise<Principal | null>;
    getWasm(): Promise<WasmEntry | null>;
    isAdmin(principal: Principal): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    removeAdmin(principal: Principal): Promise<OpResult>;
    storeWasm(wasm: Uint8Array): Promise<OpResult>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
