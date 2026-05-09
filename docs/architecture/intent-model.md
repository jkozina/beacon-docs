---
title: "Intent Model"
sidebar_position: 3
description: "How Beacon derives FQDN-first intent from developer implementation config and owns enrichment, approval, verdict binding, and runtime state."
---

# Intent Model

The intent model is the contract between application teams and Beacon.

Developers should work in the implementation tools they already own: Helm values, Terraform, Kubernetes manifests, Kustomize overlays, mesh config, or platform abstractions. Beacon should derive canonical intent from those files, then handle the hard parts: destination resolution, ownership lookup, metadata enrichment, policy evaluation, verdict binding, deployment tracking, drift detection, and audit.

Our rule is simple:

> Developer Git stores implementation config and optional derived intent or approval proof. Beacon stores enrichment, verdicts, implementation hashes, runtime state, drift, and audit history.

This keeps the developer experience small while still giving security, network, platform, and audit teams the depth they need.

## Why FQDN-First

We shouldn't expect developers to know a destination's owner, compliance domain, VIP, IPAM record, Prisma context, Illumio labels, Palo Alto path, or route boundary. They usually know the DNS name their application needs to reach.

That's enough to start.

Beacon can resolve the FQDN into a policy-ready destination identity by joining data from DNS, service catalogs, ServiceNow, Prisma, IPAM, Kubernetes, cloud APIs, and existing control-plane inventory.

## Implementation-Native Inputs

Most teams shouldn't need to hand-write `NetworkIntent`. They should define the implementation they need and let the Beacon Action extract intent from it.

Example Helm values:

```yaml
egress:
  allow:
    - name: payments
      host: payments-api.prod.company.internal
      port: 443
      protocol: HTTPS
      justification: Submit payment authorization requests
      ttlDays: 30
```

Example Terraform:

```hcl
resource "aws_security_group_rule" "orders_to_payments" {
  type        = "egress"
  protocol    = "tcp"
  from_port   = 443
  to_port     = 443
  cidr_blocks = ["10.42.18.25/32"]

  tags = {
    beacon_destination_fqdn = "payments-api.prod.company.internal"
    beacon_justification   = "Submit payment authorization requests"
    beacon_ttl_days        = "30"
  }
}
```

## Derived NetworkIntent

The Beacon Action normalizes implementation-native config into a canonical `NetworkIntent`. This object is intentionally small and can be stored as workflow evidence or sent directly to Beacon as JSON.

Extraction is strict. If Beacon can't safely derive the full intent from the implementation, the PR fails instead of guessing.

```yaml
apiVersion: network.company.com/v1
kind: NetworkIntent
metadata:
  name: orders-to-payments
spec:
  source:
    workloadId: orders-api
    namespace: orders
    serviceAccount: orders-api
  destination:
    fqdn: payments-api.prod.company.internal
  traffic:
    protocol: TCP
    port: 443
    applicationProtocol: HTTPS
  purpose:
    businessJustification: "Submit payment authorization requests"
    ticket: CHG123456
  lifecycle:
    requestedTtlDays: 365
```

The derived intent makes the request explicit: this workload needs egress to this FQDN on this protocol and port for this reason.

Direct `NetworkIntent` authoring should remain available for advanced cases, shared platform modules, or implementation types without a supported extractor. It just shouldn't be the common developer burden.

## Beacon-Enriched Intent

Before the Policy Decision Point (PDP) sees the request, Beacon enriches it with the context policy actually needs:

- source central ID, owner, environment, tenant, compliance domain, trust zone
- destination service ID, owner, VIP, environment, tenant, compliance domain, trust zone
- resolution confidence and source systems
- ServiceNow and Prisma context
- primary and transitive control expectations
- destination-owner policy
- repo, commit, PR, workflow run, and ticket metadata

This enriched object is the canonical PDP input envelope. OPA may evaluate it as JSON instead of YAML, but the key names and hierarchy should stay aligned. That prevents one schema for controllers, another schema for policy, and a third schema for audit.

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
    network.company.com/source-repo: github.company.com/retail/orders-api
    network.company.com/source-commit: 91c7e5d
    network.company.com/pull-request: "1259"
    network.company.com/workflow-run-id: "982901771"
    network.company.com/requested-by: jane.engineer
    network.company.com/decision-id: dec-018f7d2f
spec:
  source:
    workloadId: orders-api
    centralId: app-orders
    appName: Orders API
    ownerTeam: team-orders
    supportGroup: retail-orders-platform
    platform: eks
    accountId: "123456789012"
    region: us-east-1
    cluster: eks-prod-use1-retail-a
    namespace: orders
    serviceAccount: orders-api
    environment: prod
    tenant: retail
    trustZone: intranet-app
    complianceDomain: non-pci
    dataClassification: confidential
    identity:
      iamRoleArn: arn:aws:iam::123456789012:role/orders-api-prod
    serviceNow:
      businessService: Retail Ordering
      assetRecord: SN-ASSET-100233
      lifecycleState: active
    prisma:
      cloudResourceId: arn:aws:eks:us-east-1:123456789012:cluster/eks-prod-use1-retail-a
      postureFindings: []
  destination:
    requestedFqdn: payments-api.prod.company.internal
    canonicalFqdn: payments-api.service.prod.company.internal
    type: service
    serviceId: app-payments-api
    appName: Payments API
    ownerTeam: team-payments
    supportGroup: retail-payments-platform
    environment: prod
    tenant: retail
    trustZone: pci-app
    complianceDomain: pci
    dataClassification: restricted
    vip: 10.42.18.25
    exposure: internal
    backingPlatform: openshift
    cluster: ocp-prod-dc1-payments
    namespace: payments
    resolution:
      status: resolved
      confidence: high
      sources:
        - internal-dns
        - ipam
        - service-catalog
        - servicenow-itam
        - prisma
        - openshift-ingress
      resolvedAddresses:
        - 10.42.18.25
      resolvedAt: "2026-05-03T18:42:11Z"
    serviceNow:
      businessService: Retail Payments
      assetRecord: SN-ASSET-882100
      lifecycleState: active
    prisma:
      cloudResourceId: null
      postureFindings: []
    ownerPolicy:
      requiresSameEnvironment: true
      allowedSourceComplianceDomains:
        - pci
        - non-pci-with-tokenized-data
      blockedSourceZones:
        - internet
  traffic:
    direction: egress
    protocol: TCP
    port: 443
    applicationProtocol: HTTPS
    sni: payments-api.prod.company.internal
    tlsRequired: true
  path:
    preferredPrimaryControl: istio-service-entry
    expectedPrimaryControls:
      - istio-service-entry
    requiredTransitiveControls:
      - equinix-pa
      - onprem-fabric-pa
      - illumio
    inspectionRequired: true
    expectedRoute:
      sourceZone: intranet-app
      destinationZone: pci-app
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
  policyContext:
    policyBundle: network-policy-bundle:v2026.05.03
    evaluationMode: enforce
    exception:
      id: null
      expiresAt: null
      approver: null
  workflow:
    provider: github
    repository: retail/orders-api
    pullRequest: 1259
    commit: 91c7e5d
    actor: jane.engineer
    workflowRunId: "982901771"
    changeTicket: CHG123456
```

In practice, Beacon stores this enriched object in its control plane and verdict store. We don't want to write the whole enriched object back into the app repo.

## Field Groups

| Field Group | Purpose |
| --- | --- |
| `metadata` | Kubernetes identity plus repo/PR annotations that make the request traceable. |
| `spec.source` | Canonical source workload identity, ownership, platform, environment, and metadata. |
| `spec.destination` | Canonical destination identity resolved from the developer-provided FQDN. |
| `spec.traffic` | Protocol, port, direction, SNI, and transport expectations. |
| `spec.path` | Primary and transitive controls Beacon expects to carry the connection. |
| `spec.purpose` | Business justification, ticket, requester, and data types. |
| `spec.lifecycle` | Requested TTL, maximum allowed TTL, and expiration. |
| `spec.policyContext` | Active policy bundle, enforcement mode, and exception context. |
| `spec.workflow` | GitHub/TFE workflow evidence used for audit and PR feedback. |
| `runtimeState` | Mutable runtime phase, deployment conditions, and drift state stored in Beacon. |

## Ownership Boundary

The boundary is where this model gets important.

Kubernetes CRDs often have a `spec` and a `status`. That works well when the object lives in the Kubernetes API server and controllers update `status`. It doesn't work as cleanly when the object is a committed file in a developer repo.

We don't want Beacon constantly committing runtime state back into application repositories. That would create merge churn, noisy pull requests, unclear ownership, and a weak audit story.

## What Developers Own

Developers own the implementation shape:

- Helm values, Terraform, Kubernetes manifests, Kustomize overlays, mesh config, or platform config
- source workload scoping through the implementation model
- destination FQDN or required metadata that lets Beacon derive one
- protocol, port, and SNI
- business justification
- ticket or change reference
- requested TTL
- repo-level context through the GitHub workflow

Developers shouldn't need to know destination VIPs, IPAM records, owner policy, ServiceNow asset IDs, Prisma findings, route placement, or every downstream policy enforcement point. They do need to use supported implementation patterns that Beacon can extract without guessing.

## What Beacon Owns

Beacon owns the system view:

- destination resolution
- ServiceNow and Prisma enrichment
- source and destination ownership
- compliance and data classification
- policy input assembly
- Beacon PDP verdicts
- signed approval records
- implementation hashes and extraction results
- deployment state
- drift state
- audit events
- replayable evidence snapshots

Beacon should store this primarily as canonical JSON. YAML is good for humans in Git. JSON is better for APIs, OPA input, schema validation, hashing, signatures, and database storage.

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

It should not include runtime `status.conditions`, implementation artifact refs, deployment state, drift state, workflow run IDs, DNS timestamps, Prisma posture findings, or mutable external inventory details. In the preferred model, implementation artifacts stay developer-owned rather than Beacon-generated.

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

## OPA Input Relationship

The Beacon PDP receives the enriched object as its input envelope, usually serialized as JSON. Rego can reference the same keys directly:

```rego
input.spec.source.centralId
input.spec.destination.resolution.confidence
input.spec.destination.dataClassification
input.spec.lifecycle.requestedTtlDays
input.spec.path.inspectionRequired
```

That keeps policy, delivery checks, assurance, and audit aligned on one contract.

## The Operating Rule

The developer repo should answer: **what implementation did this team author, and what did Beacon derive from it?**

Beacon should answer: **what did we derive, what did we discover, why did we approve or deny it, which implementation hash did we bind to, what got deployed, and does reality still match the approved derived intent?**
