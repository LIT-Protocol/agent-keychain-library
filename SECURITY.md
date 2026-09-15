# Security

This repository holds only manifests and projection code. It has no secrets, no
deployment credentials and its CI runs against in-memory upstreams. The security
model of Lit Agent Keychain, including exactly what the harness enforces around
these actions, is documented in the Keychain
[SECURITY.md](https://github.com/LIT-Protocol/chipotle/blob/main/lit-agent-keychain/SECURITY.md).

If you believe a merged action can leak a credential (through an allowed host, an
output field, or an input that changes its destination), please report it
privately to security@litprotocol.com rather than opening a public issue. A fix
ships as a new action id with the affected one marked deprecated, and Keychain
picks it up by bumping its pinned version of this package.
