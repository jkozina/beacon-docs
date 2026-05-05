---
title: "Policy Verdicting"
sidebar_position: 1
description: "How we make allow/deny decisions."
---

# Policy Verdicting

The central PDP is our **Policy Decision Point**. It evaluates enriched intent and returns a signed verdict. Enforcement still happens at the PEPs.

The authoritative evaluation happens in the managed [Beacon PDP Service](./pdp-service.md). GitHub Actions call Beacon and report the result back to the PR, but the Action is a client, not the policy engine.

We use explicit deny with implicit allow. That means a request passes unless it violates a known enterprise rule. The important catch: every allow still gets recorded. If we don't record the allow, assurance can't prove intent later.

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

The concrete Rego shape is covered in [OPA Policy Model](./opa-policy-model.md).

## Verdict Record

Every verdict needs:

- decision ID
- normalized intent
- enriched metadata snapshot
- destination resolution snapshot
- policy bundle version
- matched rule IDs
- allow/deny result
- exception reference, if any
- artifact plan
- repo, commit, PR, workflow run, TFE run, and ticket metadata
- TTL or expiration

That gives us replayability. When metadata or policy changes, we can ask: would we still allow this today?
