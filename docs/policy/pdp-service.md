---
title: "Beacon PDP Service"
sidebar_position: 2
description: "Where OPA evaluation runs and how Beacon turns policy into signed verdicts."
---

# Beacon PDP Service

Authoritative OPA evaluation runs inside the managed **Beacon PDP service**, not directly inside every application repository. GitHub Actions remains the developer-facing experience: the Action derives intent, packages repo context and implementation hash, calls Beacon, and reports the result back to the PR.

## Evaluation Boundary

```text
Developer PR
  -> GitHub Action wrapper
  -> intent extraction from Helm/Terraform/Kubernetes/platform config
  -> Beacon resolver and enrichment
  -> Beacon PDP API
       -> OPA policy bundle evaluation
       -> decision logging
       -> verdict signing
  -> PR check result
  -> developer-owned delivery rails
```

The PDP owns the decision. The Action owns developer ergonomics. Centralizing the decision keeps policy bundle version, OPA runtime version, decision logging, exception handling, signing, and replay in one auditable service boundary.

## Runtime Pattern

The PDP is a small internal API service:

```text
Beacon PDP API
├── /v1/verdict endpoint
├── OPA runtime, embedded or sidecar
├── signed policy bundle loader
├── decision log writer
├── verdict signer
└── replay endpoint for audit and regression testing
```

OPA can run embedded in the service or as a sidecar. Either way, Beacon should wrap OPA so app workflows never call raw OPA directly.

## JSON Input And Verdict Output

The PDP receives canonical JSON generated from the enriched `NetworkIntent` model. It doesn't receive YAML, and it doesn't perform broad metadata discovery itself. The JSON payload keeps the same field hierarchy used by policy, delivery checks, and audit.

Minimal input shape:

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

Verdict output includes allow/deny, deny reasons, primary and transitive controls, max TTL, exception requirements, decision ID, policy bundle version, metadata snapshot hash, implementation hash, and signature.

Rego can reference the enriched object directly:

```rego
input.spec.source.centralId
input.spec.destination.resolution.confidence
input.spec.destination.dataClassification
input.spec.lifecycle.requestedTtlDays
input.spec.path.inspectionRequired
```

That keeps policy, delivery checks, assurance, and audit aligned on one contract.

## Verdict Contract

Every allowed request should produce a durable verdict record. Downstream delivery controls should only proceed when a current signed verdict exists for the implementation hash being deployed.

```json
{
  "decisionId": "dec-018f7d2f",
  "allow": true,
  "policyBundle": "beacon-policy:v2026.05.04",
  "metadataSnapshotHash": "sha256:7e2b...",
  "implementationHash": "sha256:31a8...",
  "expiresAt": "2026-08-02T00:00:00Z",
  "controls": {
    "primary": {
      "type": "istio-serviceentry",
      "owner": "platform-mesh",
      "target": "orders/prod"
    },
    "transitive": [
      {
        "type": "palo-alto-inspection",
        "owner": "network-security",
        "target": "pci-egress"
      },
      {
        "type": "destination-owner-approval",
        "owner": "team-payments",
        "target": "app-payments-api"
      }
    ]
  },
  "signature": "..."
}
```

The signature matters because delivery systems and assurance jobs need to know the implementation is tied to a real Beacon decision, not a copied JSON blob.

If Beacon cannot explain the decision or bind it to the implementation hash, we don't deploy new connectivity.
