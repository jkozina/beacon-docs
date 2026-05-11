---
title: "Policy Verdicting"
sidebar_position: 1
description: "How we make allow/deny decisions."
---

# Policy Verdicting

The central PDP is our **Policy Decision Point**. It evaluates enriched intent and returns a signed verdict. Enforcement still happens at the PEPs.

The authoritative evaluation happens in the managed [Beacon PDP Service](./pdp-service.md). GitHub Actions call Beacon and report the result back to the PR, but the Action is a client, not the policy engine.

We use explicit deny with implicit allow. A request passes unless it violates a known enterprise rule, but every allow still gets recorded so assurance can prove intent later.

## Good Central Deny Rules

Good deny rules are clear, explainable, and tied to metadata we can prove.

| Rule Area | Example Deny |
| --- | --- |
| Destination resolution | Deny when the FQDN can't be resolved to an owned service. |
| Metadata confidence | Deny production access when destination confidence is not high. |
| Data class | Deny public workloads from restricted destinations. |
| Lifecycle | Deny new access to retired ServiceNow assets. |
| Exposure | Deny access to a destination Prisma reports as unexpectedly public. |
| TTL | Deny requests longer than the allowed maximum for the destination risk. |
| Route posture | Deny paths that bypass required Palo Alto inspection. |
| Ownership | Deny when source or destination ownership is missing. |

The concrete Rego shape is covered in [OPA Policy Model](./opa-policy-model.md). The durable verdict record is covered in [Beacon PDP Service](./pdp-service.md#verdict-contract).

