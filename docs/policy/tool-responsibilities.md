---
title: "Tool Responsibilities"
sidebar_position: 2
description: "How OPA, Sentinel, Gatekeeper, GitHub, and TFE divide the work."
---

# Tool Responsibilities

We need the tools to complement each other. We don't want OPA, Sentinel, and Gatekeeper all trying to be the same policy engine.

| Tool | Job |
| --- | --- |
| GitHub Actions | Fast PR feedback. The Action validates, calls Beacon, reports the verdict, and saves artifacts. |
| Beacon PDP API | Managed decision service that wraps OPA, logs decisions, signs verdicts, and controls policy bundle versions. |
| OPA | Rego evaluation over enriched connectivity intent inside the Beacon PDP boundary. |
| Terraform Enterprise Sentinel | Terraform plan governance for cloud/provider-managed PEPs. |
| TFE OPA policy sets | Optional Rego reuse for Terraform plan checks, if we want it. |
| Gatekeeper | Kubernetes admission and audit to prevent unmanaged mesh/Kubernetes policy. |
| Prisma | Cloud inventory and posture signal, not the final network verdict. |
| ServiceNow ITAM | Asset/lifecycle context and cleanup workflow, not runtime truth by itself. |

## Boundary We Should Hold

Beacon PDP decides whether the intent is allowed using OPA behind the service boundary. Sentinel proves the Terraform plan only implements approved intent and doesn't create broad, unmanaged controls. Gatekeeper blocks in-cluster bypass. Assurance tells us whether reality drifted.
