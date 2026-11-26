# RBE — Rust Backend Engine

RBE is a Rust backend engine built around a controlled application runtime instead of an unrestricted JavaScript/TypeScript host. Application code is written in **REL (Runtime Engine Language)** and linked by **RELC (Runtime Engine Language Compiler)** into an immutable **Runtime Image** during boot.

## REL Source Roles

REL grammar is shared across the project, while runtime authority is strictly scoped by file role:

- `*.route` — HTTP entrypoints and request/response handlers.
- `*.module` — Reusable in-process backend logic and bridge to managed services.
- `*.service` — Isolated programs supervised by the Service Runtime/Fabric (including `quickDB`).
- `server.server` — Root server composition, policy, typed Runtime ENV defaults/`FORCE` values, middleware, and embedded REL sources.

## Compilation & Runtime Image

On boot, RELC validates sources, imports, capabilities, symbols, and policies, then emits a deterministic, immutable **Runtime Image** identified by `imageId` and `sourceHash` (64-character SHA-256).

```text
settings.json + server.server + *.route + *.module + *.service
                              |
                             RELC
                              |
                              v
                    immutable Runtime Image
                              |
               +--------------+--------------+
               |              |              |
          HTTP/Module      Service         Container
            runtime         Fabric          runtime
```

## Process Isolation

RBE splits authority across dedicated executables rather than concentrating privileges in a single process:

- `backend` owns HTTP, the active Runtime Image, shared state, and top-level supervision.
- `service` runs a canonical **Service Mother** process that supervises isolated Service REL worker processes.
- `container` runs the **Container Controller**, launching per-Environment child processes and disposable WASM workers.
- **Vault** runs behind a supervised child process boundary for credentials and secrets.
- **CONTROL ER** handles bounded crash-recovery decisions without gaining arbitrary spawn authority.
