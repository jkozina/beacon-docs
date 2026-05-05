---
title: "GitHub Action Verdict"
sidebar_position: 2
description: "How developer PRs call Beacon for resolver, enrichment, and PDP evaluation."
---

# GitHub Action Verdict

Developer teams should interact with Beacon through a reusable GitHub Action or reusable workflow. That gives them a normal PR check without making every app repository understand OPA, metadata joins, or PEP-specific compilers.

## What The Action Does

The Action should stay thin. It isn't the authoritative policy engine.

Responsibilities:

- find changed intent files
- validate schema and required fields
- attach repo, PR, commit, actor, and workflow context
- call Beacon resolver and enrichment
- call Beacon PDP API
- fail the check on deny
- post human-readable remediation
- save the signed verdict artifact for downstream compiler steps

The managed Beacon PDP service owns OPA evaluation and decision logging.

## Example Developer Workflow

```yaml
name: Beacon Connectivity

on:
  pull_request:
    paths:
      - "network-intents/**"

permissions:
  contents: read
  pull-requests: write
  id-token: write

jobs:
  verdict:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Beacon connectivity verdict
        uses: company/beacon-actions/verdict@v1
        with:
          intent-path: network-intents
          beacon-url: https://beacon.company.com
          output-path: .beacon/verdicts
```

The Action can authenticate to Beacon using OIDC. That lets Beacon know which repo, branch, and workflow identity made the request without storing long-lived tokens in app repositories.

The Action shouldn't turn the app repo into Beacon's runtime database. The write-back boundary is defined in [Intent Model](../architecture/intent-model.md): stable approved intent can live in Git, while mutable enrichment, runtime status, artifacts, drift, and audit live in Beacon.

## API Calls

The Action can call one combined API or two explicit APIs.

Combined API:

```text
POST /v1/verdict
```

Separate APIs:

```text
POST /v1/resolve
POST /v1/verdict
```

Use separate internal stages behind one Action-level command. That way the PR output can tell the developer whether they failed resolution, enrichment, or policy.

## PR Output

On deny, the Action should return a concise PR comment:

```text
Beacon denied this connectivity intent.

Rule: PROD_REQUIRES_HIGH_CONFIDENCE
Reason: Production access requires high-confidence destination resolution.
Destination: payments.internal.example.com
Resolution confidence: medium

How to fix:
- Confirm the destination owner in the registry, or
- Request a temporary exception with the destination owner.
```

On allow, the Action should avoid noisy comments by default. The check summary should include:

- decision ID
- policy bundle version
- primary and transitive controls
- expiration
- artifact plan

## Artifact Handoff

The allow response should be saved as a workflow artifact or committed into a generated artifact branch, depending on how we want the delivery rails to work.

```text
.beacon/
└── verdicts/
    └── orders-api-payments-443.json
```

That verdict file should be consumed by the compiler step. The compiler should refuse to generate PEP artifacts unless the verdict is current and signed.

## Recommended Split

| Layer | Responsibility |
| --- | --- |
| App repo workflow | Calls Beacon and reports PR status. |
| Beacon Action | Client wrapper and PR ergonomics. |
| Beacon APIs | Resolution, enrichment, PDP call, decision record. |
| OPA | Policy evaluation over enriched input. |
| Compiler | Converts allowed intent into PEP-specific artifacts. |
| GitOps/TFE | Applies generated artifacts. |

This keeps the developer workflow simple while keeping the actual verdict centralized, auditable, and replayable.
