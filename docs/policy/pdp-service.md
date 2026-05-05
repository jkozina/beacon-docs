---
title: "Beacon PDP Service"
sidebar_position: 2
description: "Where OPA evaluation runs and how Beacon turns policy into signed verdicts."
---

# Beacon PDP Service

Authoritative OPA evaluation runs inside a managed **Beacon PDP service**, not directly inside every application repository.

GitHub Actions remains the developer-facing experience. The Action packages intent, repo context, commit SHA, and workflow metadata, then calls Beacon. The managed PDP performs the policy decision and records the evidence.

## Evaluation Boundary

```text
Developer PR
  -> GitHub Action wrapper
  -> Beacon resolver and enrichment
  -> Beacon PDP API
       -> OPA policy bundle evaluation
       -> decision logging
       -> verdict signing
  -> PR check result
  -> compiler and delivery rails
```

The PDP owns the decision. The Action owns developer ergonomics.

## Why Not Run OPA Only In GitHub Actions?

Running OPA locally in a workflow is useful for prototypes, but it becomes awkward at enterprise scale. We would have many repositories pulling policy, metadata, and OPA versions into their own CI runs. That creates drift and makes audit harder.

A managed PDP gives us one place to control:

- active policy bundle version
- OPA runtime version
- enriched metadata snapshot shape
- decision logging
- verdict IDs
- emergency policy changes
- exception handling
- signing and replay

The app repository should not need direct access to sensitive metadata sources. It should receive a clear allow or deny response with enough remediation detail to move forward.

The longer ownership model is captured in [Intent Model](../architecture/intent-model.md). Beacon owns the complete control-plane record; developer repositories only need the stable approved intent and optional signed approval proof.

## Runtime Pattern

The PDP is a small internal API service:

```text
Beacon PDP API
├── /v1/verdict endpoint
├── OPA runtime, embedded or sidecar
├── signed policy bundle loader
├── metadata snapshot validator
├── decision log writer
├── verdict signer
└── replay endpoint for audit and regression testing
```

OPA can run in one of three ways:

| Pattern | Fit |
| --- | --- |
| Embedded OPA library | Best if the PDP is written in Go and we want low-latency in-process decisions. |
| OPA sidecar | Good Kubernetes-native pattern. The PDP calls local OPA and owns auth, logging, and response shape. |
| Central OPA server | Acceptable, but Beacon should still wrap it. We don't want app workflows calling raw OPA directly. |

For our platform, **Beacon PDP API plus OPA sidecar** or **embedded OPA** are the cleanest starting points. Both keep the authoritative decision inside the Beacon service boundary.

## JSON Input And Verdict Output

The PDP receives canonical JSON generated from the enriched `NetworkIntent` model. It doesn't receive YAML, and it doesn't perform broad metadata discovery itself. The JSON payload keeps the same field hierarchy as the YAML examples so policy, compilers, and audit use one contract.

Input fields:

- `metadata` traceability fields
- `spec.source` workload identity, ownership, environment, and platform metadata
- `spec.destination` resolved service identity, ownership, resolution confidence, and owner policy
- `spec.traffic` protocol, port, direction, and SNI
- `spec.path` primary controls, transitive controls, and inspection requirements
- `spec.purpose` business justification, ticket, requester, and data types
- `spec.lifecycle` requested TTL, maximum TTL, and expiration
- `spec.policyContext` active bundle, enforcement mode, and exception references
- `spec.workflow` repo, PR, commit, actor, and workflow run evidence

Minimal shape:

```json
{
  "metadata": {
    "name": "orders-to-payments",
    "namespace": "orders"
  },
  "spec": {
    "source": {
      "workloadId": "orders-api",
      "centralId": "app-orders",
      "environment": "prod"
    },
    "destination": {
      "requestedFqdn": "payments-api.prod.company.internal",
      "serviceId": "app-payments-api",
      "resolution": {
        "status": "resolved",
        "confidence": "high"
      },
      "dataClassification": "restricted"
    },
    "traffic": {
      "direction": "egress",
      "protocol": "TCP",
      "port": 443,
      "applicationProtocol": "HTTPS"
    },
    "lifecycle": {
      "requestedTtlDays": 30,
      "maxAllowedTtlDays": 30
    }
  }
}
```

Verdict output:

- `allow`
- `deny` reasons and rule IDs
- primary and transitive controls
- maximum TTL
- exception requirements
- decision ID
- policy bundle version
- metadata snapshot hash
- signed verdict envelope

## Verdict Contract

Every allowed request should produce a durable verdict record. Downstream compilers should only generate policy when a current verdict exists.

```json
{
  "decisionId": "dec-018f7d2f",
  "allow": true,
  "policyBundle": "beacon-policy:v2026.05.04",
  "metadataSnapshotHash": "sha256:7e2b...",
  "expiresAt": "2026-08-02T00:00:00Z",
  "controls": {
    "primary": {
      "type": "istio-serviceentry",
      "owner": "platform-mesh",
      "target": "orders/prod",
      "reason": "Source workload egress is mediated by the mesh."
    },
    "transitive": [
      {
        "type": "palo-alto-inspection",
        "owner": "network-security",
        "target": "pci-egress",
        "reason": "Traffic enters a restricted PCI destination zone."
      },
      {
        "type": "destination-owner-approval",
        "owner": "team-payments",
        "target": "app-payments-api",
        "reason": "Destination owner policy requires approval."
      }
    ]
  },
  "artifactPlan": [
    {
      "pep": "istio-serviceentry",
      "scope": "orders/prod"
    }
  ],
  "signature": "..."
}
```

The signature matters because delivery systems and assurance jobs need to know that an artifact came from a real Beacon decision, not from a copied JSON blob.

## Failure Modes

The PDP should fail closed when it cannot make a trustworthy decision.

| Condition | Behavior |
| --- | --- |
| Destination cannot be resolved | Deny with remediation. |
| Metadata confidence is too low for the environment | Deny or require exception. |
| Policy bundle cannot be loaded | Fail the PR check. |
| PDP is unavailable | Fail the PR check and mark as platform unavailable. |
| Verdict is expired | Compiler refuses to generate or apply artifacts. |
| Metadata changed materially after approval | Assurance opens a drift finding. |

That gives us a clean rule: if Beacon cannot explain and record the decision, we don't deploy new connectivity.
