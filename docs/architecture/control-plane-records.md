---
title: "Control-Plane Records"
sidebar_position: 4
description: "What Beacon writes back to Git, what Beacon stores, and which formats we use."
---

# Control-Plane Records

Beacon needs two durable record shapes:

- a stable approval artifact that may live in the developer repo
- a richer control-plane record that lives in Beacon

The developer repo should not become Beacon's runtime database. Git can hold implementation config and optional approval proof. Beacon should hold mutable enrichment, verdicts, deployment state, drift, and audit history.

## What Gets Written Back To Git

After approval, Beacon may write back a stable derived `NetworkIntent` or approval proof to the developer repo. That object should include the durable contract:

- what was requested
- what canonical destination Beacon approved
- what TTL was allowed
- which primary and transitive controls are required
- which policy bundle made the decision
- which rules matched
- the metadata snapshot hash
- the signed approval

It should not include runtime `status.conditions`, implementation artifact refs, deployment state, drift state, workflow run IDs, DNS timestamps, Prisma posture findings, or mutable external inventory details. Implementation artifacts stay developer-owned rather than Beacon-generated.

## Optional Approved NetworkIntent

This is the version we're comfortable keeping in the app team's repository after Beacon approval when we want durable Git evidence. It's derived from implementation config and enriched enough to be useful, but not so enriched that the app repo becomes a control-plane database.

```yaml
apiVersion: network.company.com/v1
kind: NetworkIntent
metadata:
  name: orders-to-payments
  namespace: orders
  labels:
    network.company.com/central-id: app-orders
    network.company.com/environment: prod
    network.company.com/tenant: retail
  annotations:
    network.company.com/decision-id: dec-018f7d2f

spec:
  source:
    workloadId: orders-api
    centralId: app-orders
    namespace: orders
    serviceAccount: orders-api
    environment: prod
    tenant: retail

  destination:
    requestedFqdn: payments-api.prod.company.internal
    canonicalFqdn: payments-api.service.prod.company.internal
    serviceId: app-payments-api

  traffic:
    direction: egress
    protocol: TCP
    port: 443
    applicationProtocol: HTTPS
    sni: payments-api.prod.company.internal
    tlsRequired: true

  purpose:
    businessJustification: Submit payment authorization requests
    ticket: CHG123456
    requestedBy: jane.engineer
    dataTypes:
      - payment_token

  lifecycle:
    requestedTtlDays: 30
    maxAllowedTtlDays: 30
    expiresAt: "2026-06-02"

  approval:
    decisionId: dec-018f7d2f
    allow: true
    policyBundle: network-policy-bundle:v2026.05.03
    evaluatedAt: "2026-05-03T18:42:22Z"
    expiresAt: "2026-06-02"
    controls:
      primary:
        type: istio-service-entry
        owner: platform-mesh
        target: eks-prod-use1-retail-a/orders
        reason: Source workload egress is mediated by the mesh.
      transitive:
        - type: equinix-pa
          owner: network-security
          target: hybrid-egress
          reason: Traffic crosses the hybrid inspection boundary.
        - type: onprem-fabric-pa
          owner: network-security
          target: pci-datacenter-edge
          reason: Destination is in the PCI application zone.
        - type: illumio
          owner: segmentation
          target: payments-workload-policy
          reason: Destination workload requires explicit source allow-listing.
        - type: destination-owner-approval
          owner: team-payments
          target: app-payments-api
          reason: Destination owner policy requires approval for restricted data access.
    matchedRules:
      - TTL_RESTRICTED_DESTINATION_MAX_30D
      - PCI_DESTINATION_REQUIRES_INSPECTION
      - RESTRICTED_DESTINATION_REQUIRES_OWNER_POLICY
    metadataSnapshotHash: sha256:7e2b9c1f4a6c0c4f2b9d5a81d92e36f9b6a0f2d9e9b8b0b2a8b16d3a7d6f91ad
    signature: beacon-signature:v1:MEUCIQD...
```

The approval block is intentionally immutable. If the destination changes materially, the policy bundle changes, or the TTL expires, Beacon should create a new decision instead of mutating the old one.

## Beacon Control-Plane Record

Beacon stores the full control-plane record as canonical JSON. The record wraps the implementation source, derived intent, enrichment snapshot, policy decision, implementation hash, runtime state, and audit history. The full enrichment can live as an embedded JSON object or as a referenced snapshot with a content hash.

```json
{
  "intentId": "ni-orders-to-payments",
  "currentPhase": "deployed",
  "implementationSource": {
    "sourceRepo": "github.company.com/retail/orders-api",
    "paths": [
      "charts/orders/values.yaml",
      "terraform/security-groups.tf"
    ],
    "sourceCommit": "91c7e5d",
    "pullRequest": 1259,
    "submittedBy": "jane.engineer",
    "submittedAt": "2026-05-03T18:41:00Z"
  },
  "derivedIntentRef": {
    "intentName": "orders-to-payments",
    "snapshotHash": "sha256:31a8..."
  },
  "implementationHash": "sha256:31a8...",
  "enrichmentRef": {
    "enrichmentId": "enr-20260503-184216",
    "createdAt": "2026-05-03T18:42:16Z",
    "sources": [
      "servicenow-itam",
      "prisma",
      "internal-dns",
      "ipam",
      "service-catalog",
      "openshift-ingress"
    ],
    "snapshotHash": "sha256:7e2b9c1f4a6c0c4f2b9d5a81d92e36f9b6a0f2d9e9b8b0b2a8b16d3a7d6f91ad"
  },
  "policyEvaluation": {
    "decisionId": "dec-018f7d2f",
    "enrichmentId": "enr-20260503-184216",
    "allow": true,
    "evaluatedAt": "2026-05-03T18:42:22Z",
    "policyBundle": "network-policy-bundle:v2026.05.03",
    "requestedTtlDays": 30,
    "maxAllowedTtlDays": 30,
    "expiresAt": "2026-06-02",
    "denyReasons": [],
    "controls": {
      "primary": {
        "type": "istio-service-entry",
        "owner": "platform-mesh",
        "target": "eks-prod-use1-retail-a/orders"
      },
      "transitive": [
        {
          "type": "equinix-pa",
          "owner": "network-security",
          "target": "hybrid-egress"
        },
        {
          "type": "onprem-fabric-pa",
          "owner": "network-security",
          "target": "pci-datacenter-edge"
        },
        {
          "type": "illumio",
          "owner": "segmentation",
          "target": "payments-workload-policy"
        },
        {
          "type": "destination-owner-approval",
          "owner": "team-payments",
          "target": "app-payments-api"
        }
      ]
    },
    "matchedRules": [
      "TTL_RESTRICTED_DESTINATION_MAX_30D",
      "PCI_DESTINATION_REQUIRES_INSPECTION",
      "RESTRICTED_DESTINATION_REQUIRES_OWNER_POLICY"
    ],
    "signature": "beacon-signature:v1:MEUCIQD..."
  },
  "extraction": {
    "status": "complete",
    "extractor": "helm-values:v1",
    "implementation": {
      "type": "helm-values",
      "path": "charts/orders/values.yaml"
    },
    "findings": []
  },
  "runtimeState": {
    "phase": "deployed",
    "conditions": [
      {
        "type": "Verdicted",
        "status": "True",
        "reason": "PdpAllowed",
        "lastTransitionTime": "2026-05-03T18:42:22Z"
      },
      {
        "type": "Deployed",
        "status": "True",
        "reason": "GitOpsSynced",
        "lastTransitionTime": "2026-05-03T18:45:03Z"
      },
      {
        "type": "DriftDetected",
        "status": "False",
        "reason": "RuntimeMatchesApprovedIntent",
        "lastTransitionTime": "2026-05-03T18:52:19Z"
      }
    ]
  },
  "audit": {
    "latestEvents": [
      "intent.submitted",
      "intent.enriched",
      "intent.approved",
      "implementation.bound",
      "deployment.synced"
    ]
  }
}
```

## Storage Format

Beacon should use a practical split:

| Data | Store | Format |
| --- | --- | --- |
| Intent index, current phase, ownership, expiration | PostgreSQL | columns |
| Implementation, derived intent, and enriched snapshots | PostgreSQL JSONB or object storage | canonical JSON |
| Verdicts and approvals | PostgreSQL | columns plus JSONB |
| Extraction results and implementation hashes | PostgreSQL JSONB | canonical JSON |
| Runtime conditions | PostgreSQL | relational rows or JSONB |
| Audit events | PostgreSQL append-only table or event stream | CloudEvents-style JSON |
| Large evidence snapshots | S3-compatible object storage | JSON plus content hash |
| Search and reporting | OpenSearch or Elasticsearch | indexed JSON |
| Policy bundles | Git or OCI registry | signed OPA bundle |

PostgreSQL with JSONB should be the primary system of record. It gives us transactions, queryability, and enough flexibility while the schema matures. Object storage is useful for larger evidence snapshots and replay payloads.
