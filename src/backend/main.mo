import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Prim "mo:prim";
import AccessControl "./authorization/access-control";
import Outcall "./http-outcalls/outcall";

actor {
  // ---------- Types ----------
  type OpResult = { #ok; #err : Text };

  // ---------- State ----------
  var accessControlState = AccessControl.initState();
  var owner : ?Principal = null;
  var adminList : [Principal] = [];

  type WasmEntry = { wasm : Blob; compiledAt : Int };
  var wasmStore = Map.empty<Principal, WasmEntry>();

  // ---------- Authorization ----------
  public shared ({ caller }) func _initializeAccessControlWithSecret(userSecret : Text) : async () {
    switch (Prim.envVar<system>("CAFFEINE_ADMIN_TOKEN")) {
      case (null) { Prim.trap("CAFFEINE_ADMIN_TOKEN environment variable is not set") };
      case (?adminToken) {
        AccessControl.initialize(accessControlState, caller, adminToken, userSecret);
        if (owner == null and AccessControl.isAdmin(accessControlState, caller)) {
          owner := ?caller;
          adminList := [caller];
        };
      };
    };
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  // ---------- Admin Whitelist ----------
  public query func getOwner() : async ?Principal { owner };

  public query func getAdmins() : async [Principal] { adminList };

  public shared ({ caller }) func addAdmin(principal : Principal) : async OpResult {
    switch (owner) {
      case (null) { #err("No owner set") };
      case (?o) {
        if (caller != o) { return #err("Only the owner can add admins") };
        for (p in adminList.vals()) {
          if (p == principal) { return #ok };
        };
        accessControlState.userRoles.add(principal, #admin);
        adminList := adminList.concat([principal]);
        #ok;
      };
    };
  };

  public shared ({ caller }) func removeAdmin(principal : Principal) : async OpResult {
    switch (owner) {
      case (null) { #err("No owner set") };
      case (?o) {
        if (caller != o) { return #err("Only the owner can remove admins") };
        if (principal == o) { return #err("Cannot remove the owner") };
        accessControlState.userRoles.add(principal, #user);
        adminList := adminList.filter(func(p : Principal) : Bool { p != principal });
        #ok;
      };
    };
  };

  public query func isAdmin(principal : Principal) : async Bool {
    AccessControl.isAdmin(accessControlState, principal);
  };

  // ---------- WASM Storage ----------
  public shared ({ caller }) func storeWasm(wasm : Blob) : async OpResult {
    if (caller.isAnonymous()) { return #err("Must be authenticated") };
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return #err("Only admins can store WASM");
    };
    wasmStore.add(caller, { wasm; compiledAt = Time.now() });
    #ok;
  };

  public query ({ caller }) func getWasm() : async ?WasmEntry {
    wasmStore.get(caller);
  };

  // HTTP outcall transform
  public query func transform(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    Outcall.transform(input);
  };
};
