---
title: "Intent Model"
sidebar_position: 3
description: "How developers declare FQDN-first connectivity and how Beacon owns enrichment, approval, and runtime state."
---

# Intent Model

The intent model is the contract between application teams and Beacon.

Developers should declare the destination they actually understand: the FQDN they need to call. Beacon should handle the hard parts: destination resolution, ownership lookup, metadata enrichment, policy evaluation, control placement, approval proof, artifact generation, deployment tracking, drift detection, and audit.

Our rule is simple:

> Developer Git stores stable FQDN-first intent and immutable approval proof. Beacon stores enrichment, evidence, runtime state, generated artifacts, drift, and audit history.

This keeps the developer experience small while still giving security, network, platform, and audit teams the depth they need.

## Why FQDN-First

We shouldn't expect developers to know a destination's owner, compliance domain, VIP, IPAM record, Prisma context, Illumio labels, Palo Alto path, or route boundary. They usually know the DNS name their application needs to reach.

That's enough to start.

Beacon can resolve the FQDN into a policy-ready destination identity by joining data from DNS, service catalogs, ServiceNow, Prisma, IPAM, Kubernetes, cloud APIs, and existing control-plane inventory.

## Developer-Written Intent

This is the shape developers should be able to write by hand. It's intentionally small.

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

The developer is making a clear request: this workload needs egress to this FQDN on this protocol and port for this reason.

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

Developers own the request shape:

- source workload identity
- destination FQDN
- protocol, port, and SNI
- business justification
- ticket or change reference
- requested TTL
- repo-level context through the GitHub workflow

Developers shouldn't need to know destination VIPs, IPAM records, owner policy, ServiceNow asset IDs, Prisma findings, route placement, or which downstream policy enforcement points will be touched.

## What Beacon Owns

Beacon owns the system view:

- destination resolution
- ServiceNow and Prisma enrichment
- source and destination ownership
- compliance and data classification
- policy input assembly
- Beacon PDP verdicts
- signed approval records
- generated artifact manifests
- deployment state
- drift state
- audit events
- replayable evidence snapshots

Beacon should store this primarily as canonical JSON. YAML is good for humans in Git. JSON is better for APIs, OPA input, schema validation, hashing, signatures, and database storage.

## What Gets Written Back To Git

After approval, Beacon may write back a stable approved `NetworkIntent` to the developer repo. That approved object should include the durable contract:

- what was requested
- what canonical destination Beacon approved
- what TTL was allowed
- which primary and transitive controls are required
- which policy bundle made the decision
- which rules matched
- the metadata snapshot hash
- the signed approval

It should not include runtime `status.conditions`, generated artifact refs, deployment state, drift state, workflow run IDs, DNS timestamps, Prisma posture findings, or mutable external inventory details.

## Approved Developer Repo NetworkIntent

This is the version we're comfortable keeping in the app team's repository after Beacon approval. It's enriched enough to be useful, but not so enriched that the app repo becomes a control-plane database.

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

Beacon stores the full control-plane record as canonical JSON. The record wraps the declared intent, enrichment snapshot, policy decision, generated artifact set, runtime state, and audit history. The full enrichment can live as an embedded JSON object or as a referenced snapshot with a content hash.

```json
{
  "intentId": "ni-orders-to-payments",
  "currentPhase": "deployed",
  "declaredIntent": {
    "sourceRepo": "github.company.com/retail/orders-api",
    "sourcePath": "network/intents/orders-to-payments.yaml",
    "sourceCommit": "91c7e5d",
    "pullRequest": 1259,
    "submittedBy": "jane.engineer",
    "submittedAt": "2026-05-03T18:41:00Z"
  },
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
  "artifactSet": {
    "artifactSetId": "art-20260503-184231",
    "generatedAt": "2026-05-03T18:42:31Z",
    "artifacts": [
      {
        "kind": "IstioServiceEntry",
        "target": "eks-prod-use1-retail-a",
        "namespace": "orders",
        "gitRepo": "github.company.com/platform/network-controls",
        "gitPath": "generated/eks-prod-use1-retail-a/orders/serviceentry-orders-to-payments.yaml",
        "contentHash": "sha256:abc123..."
      }
    ]
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
      "artifacts.generated",
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
| Declared and enriched snapshots | PostgreSQL JSONB or object storage | canonical JSON |
| Verdicts and approvals | PostgreSQL | columns plus JSONB |
| Artifact manifests | PostgreSQL JSONB | canonical JSON |
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

That keeps policy, compilers, assurance, and audit aligned on one contract.

## The Operating Rule

The developer repo should answer: **what connectivity did this team request, and what did Beacon approve?**

Beacon should answer: **what did we discover, why did we approve or deny it, what did we generate, what got deployed, and does reality still match the approved intent?**
