---
title: "Tool Responsibilities"
sidebar_position: 2
description: "How OPA, Sentinel, Gatekeeper, GitHub, and TFE divide the work."
---

# Tool Responsibilities

We need the tools to complement each other. We don't want OPA, Sentinel, and Gatekeeper all trying to be the same policy engine.

| Tool | Job |
| --- | --- |
| GitHub Actions | Fast PR feedback: schema, resolver, enrichment, OPA verdict, compiler dry-run. |
| Central OPA PDP | OPA Policy Decision Point for enterprise network verdicts over canonical connectivity intent. |
| Terraform Enterprise Sentinel | Terraform plan governance for cloud/provider-managed PEPs. |
| TFE OPA policy sets | Optional Rego reuse for Terraform plan checks, if we want it. |
| Gatekeeper | Kubernetes admission and audit to prevent unmanaged mesh/Kubernetes policy. |
| Prisma | Cloud inventory and posture signal, not the final network verdict. |
| ServiceNow ITAM | Asset/lifecycle context and cleanup workflow, not runtime truth by itself. |

## Boundary We Should Hold

OPA decides whether the intent is allowed. Sentinel proves the Terraform plan only implements approved intent and doesn't create broad, unmanaged controls. Gatekeeper blocks in-cluster bypass. Assurance tells us whether reality drifted.
