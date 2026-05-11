<!-- Source: docs/README.md -->

---
title: Architecture Guide
slug: /
sidebar_position: 0
---

# Beacon

This is our internal design for building Beacon, our Enterprise Connectivity Control Plane, across cloud, Kubernetes, service mesh, Palo Alto, Illumio, and hybrid data center controls.

Start with [Executive Model](./overview/executive-model.mdx), then read [End-To-End Architecture](./architecture/end-to-end-architecture.mdx), [Intent Model](./architecture/intent-model.md), and [Control-Plane Records](./architecture/control-plane-records.md).

The longer source artifact is preserved one directory up as enterprise-e2e-firewall-architecture.md.

---

<!-- Source: docs/overview/executive-model.mdx -->

---
title: "Executive Model"
sidebar_position: 1
description: "The end-to-end model in a form we can use with technical leaders."
---

import ExecutiveFlowDiagram from '@site/src/components/diagrams/ExecutiveFlowDiagram';

# Executive Model

We're building **Beacon**, our Enterprise Connectivity Control Plane, because the old firewall model doesn't scale for our environment. We have too many accounts, clusters, VPCs, data center fabrics, meshes, endpoints, and enforcement points to keep treating connectivity as a ticket-by-ticket firewall exercise.

The model we're aiming for is simple:

- Developers define connectivity in the implementation config they already own.
- Beacon derives canonical intent from that implementation.
- We resolve the destination and enrich the request with enterprise metadata.
- We make the network security verdict early, before a control is deployed.
- We bind the verdict to the implementation hash that produced the derived intent.
- We keep transitive firewalls broad, stable, and pre-paved.
- We continuously prove that derived, approved, implemented, deployed, and observed states still line up.

## The Story In One Diagram

<ExecutiveFlowDiagram />

## Why This Works

The key move is separating **specific app intent** from **stable transit policy**.

Specific intent belongs near the source or protected destination: Istio ServiceEntry, VPC endpoint policy, Lambda or workload security group, Illumio policy, or a targeted GCP control. Transitive controls like Palo Alto GWLB firewalls, Equinix transit firewalls, and data center segmentation firewalls shouldn't churn every time an app team needs a new connection. Those controls should carry broad enterprise corridor rules and inspection requirements.

That gives us developer speed without giving up control. App teams work in GitHub and keep ownership of Helm, Terraform, Kubernetes, and mesh configuration. Security gets a real verdict bound to the implementation before policy lands. Network teams stop taking low-value app-specific firewall changes on transit devices. Audit gets a chain of evidence from implementation source to runtime.

## What We Get

| Outcome | Why it matters |
| --- | --- |
| Faster delivery | Teams keep using their normal implementation workflow while Beacon derives the FQDN-first intent. |
| Stronger security | We block bad intent and unsupported or lossy extraction before controls are deployed. |
| Lower firewall churn | Transit firewalls carry stable corridor policy instead of app-specific rules. |
| Better metadata | Unknown owners, ambiguous FQDNs, and stale asset records become measurable work. |
| Cleaner audit | We can trace an allow from implementation source to derived intent to verdict to deployed control to observed flow. |
| Safer scale | AWS, GCP, EKS, OpenShift, Palo Alto, Illumio, and mesh differences sit behind extractors, verdict binding, and assurance. |

---

<!-- Source: docs/overview/problem-and-principles.md -->

---
title: "Problem And Principles"
sidebar_position: 2
description: "The practical problem we're solving and the principles we're using."
---

# Problem And Principles

We're solving end-to-end firewalling across a large hybrid environment:

- Many AWS accounts, mostly EKS, with Istio controlling mesh egress.
- Lambda in routed VPCs.
- Internet VPC egress crossing Palo Alto inspection through GWLB.
- DirectConnect into on-prem through Equinix Palo Alto transit firewalls.
- On-prem data center fabrics segmented by Palo Alto.
- Illumio on a large population of on-prem workloads.
- Many OpenShift clusters using Istio in the same way as EKS.
- GCP firewall rules and Private Service Connect in the mix.

The hard part isn't one firewall. It's the fact that one connection can cross a source-near control plus several transitive controls before it reaches the destination.

## Principles

1. **Intent is the product.** We ask teams for the connection they need, not every firewall primitive needed to implement it.
2. **FQDN-first is the default.** Most teams know the destination FQDN. They usually don't know the destination owner, VIP, compliance domain, Illumio labels, Palo Alto zone, or transitive path.
3. **Primary controls get specific policy.** The app-specific allow goes as close to the source or protected destination as our PEPs allow.
4. **Transitive controls stay broad.** We pre-pave corridor policy so ordinary app connectivity doesn't require transit firewall orchestration.
5. **Verdict happens early.** We evaluate policy in GitHub/Terraform delivery flow before writing primary-control policy.
6. **Explicit deny, implicit allow.** Our central policy model blocks known-bad patterns and records all verdicts for assurance.
7. **Assurance is part of the design.** We don't stop at deployment. We prove runtime still matches approved derived intent.

---

<!-- Source: docs/architecture/end-to-end-architecture.mdx -->

---
title: "End-To-End Architecture"
sidebar_position: 1
description: "The Beacon architecture, input/output model, control-plane flow, and day-2 assurance loop."
---

import ArchitectureFlowDiagram from '@site/src/components/diagrams/ArchitectureFlowDiagram';
import SystemDesignIOFlowDiagram from '@site/src/components/diagrams/SystemDesignIOFlowDiagram';

# End-To-End Architecture

Beacon is our enterprise connectivity control plane. It doesn't replace Palo Alto, Istio, security groups, endpoint policies, GCP firewall rules, PSC, or Illumio. It gives us one consistent path to extract connectivity intent, enrich it, verdict it, bind the approval to the implementation, and assure runtime.

> Developers author implementation configuration. Beacon strictly derives `NetworkIntent`, evaluates policy, binds the verdict to the implementation hash, and continuously assures runtime.

In the common path, developers don't hand-write `NetworkIntent`. They write Helm values, Terraform, Kubernetes manifests, Kustomize overlays, mesh config, or platform config. The Beacon GitHub Action extracts intent from those files and sends the derived intent to Beacon.

<ArchitectureFlowDiagram />

## Main Components

| Component | What we use it for |
| --- | --- |
| GitHub Enterprise | Source of record for implementation config, review history, workflow artifacts, policy bundles, and verdict evidence. |
| GitHub Actions | PR feedback: strict extraction, schema checks, destination resolution, enrichment, Beacon verdict, and verdict binding. |
| Intent Extractor | Derives `NetworkIntent` from supported implementation config. |
| Destination Resolver | Turns FQDN-first intent into policy-ready destination identity. |
| Metadata Enrichment | Adds ownership, environment, tenant, compliance, asset, posture, cloud, and route context. |
| Beacon API | Normalizes requests, orchestrates enrichment, stores records, and drives assurance. |
| Beacon PDP API | Wraps OPA, logs decisions, signs verdicts, and returns allow/deny. |
| Terraform Enterprise + Sentinel | Applies developer-owned cloud/provider controls and blocks bad plan shapes. |
| Gatekeeper | Blocks unmanaged Kubernetes and mesh resources that bypass Beacon. |
| Assurance Graph | Links implementation config, derived intent, verdicts, deployed config, routes, logs, and flows. |

## Input/Output Model

<SystemDesignIOFlowDiagram />

Beacon works because every stage produces a durable record. The PR check is feedback; the control-plane records are the system of record.

| Record | Format | Owner | Purpose |
| --- | --- | --- | --- |
| Implementation config | YAML, HCL, JSON | App team | Developer-owned Helm, Terraform, Kubernetes, mesh, or platform config. |
| Extraction result | JSON | Beacon Action | Whether Beacon safely derived intent from implementation config. |
| Derived `NetworkIntent` | YAML/JSON | Beacon Action | Canonical intent extracted from implementation config. |
| Canonical request | JSON | Beacon API | Derived intent plus repo, PR, actor, commit, workflow context, and implementation hash. |
| Enrichment snapshot | JSON | Beacon enrichment | Metadata from DNS, ServiceNow, Prisma, cloud, IPAM, catalog, and identity. |
| Verdict | JSON | Beacon PDP | Signed allow/deny result, controls, matched rules, metadata hash, and implementation hash. |
| Runtime state | JSON | Beacon assurance | Deployed PEP state, sync status, observed flows, routes, posture, and drift findings. |

The detailed Git write-back, Beacon-owned record, and storage model lives in [Control-Plane Records](./control-plane-records.md).

## End-To-End Workflow

| Stage | Input | Processing | Output |
| --- | --- | --- | --- |
| 1. Implement | Helm, Terraform, Kubernetes, mesh, or platform config | Developer defines connectivity in their normal repo workflow. | Developer-owned implementation artifact. |
| 2. Extract | Changed implementation files | Beacon Action strictly derives one or more `NetworkIntent` objects. | Derived intent, implementation hash, extraction result. |
| 3. Resolve | Derived intent and source context | Resolver checks DNS, IPAM, ingress, load balancers, PSC, and catalogs. | Destination identity and confidence. |
| 4. Enrich | Canonical request plus destination identity | Beacon joins ServiceNow, Prisma, cloud, IAM, Kubernetes, OpenShift, Illumio, and policy metadata. | Enrichment snapshot. |
| 5. Verdict | Enriched JSON plus implementation hash | Beacon PDP evaluates signed OPA bundles and exception context. | Signed verdict bound to implementation hash. |
| 6. Deploy | Same developer-owned implementation | GitOps, Helm, Terraform Enterprise, and platform pipelines deploy after merge. | Deployed primary and transitive controls. |
| 7. Assure | Approved, deployed, and observed states | Assurance compares records and telemetry over time. | Drift findings, cleanup tasks, expiration events, replayable evidence. |

## Design Boundaries

| Boundary | Rule |
| --- | --- |
| App repo | Stores implementation config and optional derived intent or approval proof; not runtime status. |
| Beacon Action | Extracts intent, computes implementation hash, calls Beacon, and reports PR findings. |
| Beacon API | Owns enrichment, verdict records, extraction evidence, and assurance state. |
| Beacon PDP | Owns the authoritative allow/deny decision over canonical JSON. |
| Delivery rails | Apply developer-owned implementation artifacts and verify verdict binding. |
| Assurance | Proves runtime still matches approved derived intent. |

The practical outcome: Beacon is not an artifact generator. It derives intent strictly, explains the decision, binds the decision to the implementation, and keeps proving the network still matches the approved derived intent.

---

<!-- Source: docs/architecture/intent-model.md -->

---
title: "Intent Model"
sidebar_position: 3
description: "How Beacon derives FQDN-first intent from developer implementation config and owns enrichment, approval, verdict binding, and runtime state."
---

# Intent Model

The intent model is the contract between application teams and Beacon.

Developers work in the implementation tools they already own. Beacon derives canonical intent, enriches it, evaluates policy, binds the verdict to the implementation hash, and owns runtime assurance.

> Developer Git stores implementation config and optional approval proof. Beacon stores enrichment, verdicts, implementation hashes, runtime state, drift, and audit history.

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

The extraction rules and fail-closed behavior are covered in [GitHub Action Verdict](../delivery/github-action-verdict.md).

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

Durable Git evidence, Beacon-owned records, and storage format are covered in [Control-Plane Records](./control-plane-records.md). The PDP JSON relationship is covered in [Beacon PDP Service](../policy/pdp-service.md#json-input-and-verdict-output).

## The Operating Rule

The developer repo should answer: **what implementation did this team author, and what did Beacon approve?**

Beacon should answer: **what did we derive, discover, decide, bind, deploy, and continuously assure?**

---

<!-- Source: docs/architecture/control-plane-records.md -->

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

---

<!-- Source: docs/architecture/control-placement.mdx -->

---
title: "Control Placement"
sidebar_position: 2
description: "Where broad and specific policy belongs."
---

import ControlPlacementDiagram from '@site/src/components/diagrams/ControlPlacementDiagram';

# Control Placement

We need a clean line between primary and transitive controls.

## Primary Controls

Primary controls carry specific application intent. These are the controls developers usually define through Helm, Terraform, Kubernetes, mesh, or platform config, and Beacon validates them after a passing verdict.

| PEP | Role |
| --- | --- |
| Istio ServiceEntry | Primary control for mesh egress from EKS and OpenShift. |
| VPC endpoint policy | Primary control for AWS managed-service access. |
| Security groups | Primary for Lambda/EC2 where attached to workload identity; coarse/transitive when shared at node level. |
| GCP firewall rules/policies | Primary when targeted to workload identity; broad guardrail when at folder/org level. |
| Google PSC | Primary private service consumption path when paired with owner policy and firewall controls. |
| Illumio | Primary microsegmentation for non-mesh hosts and selected destination-side controls. |

## Transitive Controls

Transitive controls carry stable enterprise corridor policy. We don't want these to change for every app request.

| PEP | Role |
| --- | --- |
| Palo Alto GWLB inspection firewalls | Internet VPC inspection and broad egress risk policy. |
| Equinix Palo Alto transit firewalls | Cloud-to-on-prem and on-prem-to-cloud corridors. |
| On-prem Palo Alto fabric firewalls | Data center zone and fabric segmentation. |
| Shared EKS worker/node SGs | Coarse path control, not pod-level proof. |

<ControlPlacementDiagram />

Our default rule of thumb: if the rule names a specific app-to-app need, it belongs at a primary control. If the rule defines a stable enterprise corridor, inspection requirement, or zone boundary, it belongs at a transitive control.

---

<!-- Source: docs/metadata/destination-resolution.md -->

---
title: "Destination Resolution"
sidebar_position: 1
description: "How we turn FQDNs into policy-ready destinations."
---

# Destination Resolution

Destination resolution is a core service. It turns an FQDN-first request into a destination identity that policy can reason about.

## Inputs

- requested FQDN
- protocol and port
- source account/project, cluster, namespace, environment, tenant
- request timestamp
- optional SNI or service alias

## Sources We Correlate

- DNS, private zones, split-horizon views, and CNAME chains
- IPAM and VIP systems
- Kubernetes/OpenShift ingress and service inventory
- Istio service registry and existing ServiceEntry inventory
- AWS VPC endpoints, load balancers, private hosted zones, and resource tags
- GCP PSC, load balancers, private DNS, and labels
- ServiceNow ITAM, where asset ownership/lifecycle exists
- Prisma public cloud inventory and posture findings
- service catalog, CMDB, Illumio labels, and Palo Alto objects/logs

## Resolution Statuses

| Status | What it means | What we do |
| --- | --- | --- |
| resolved | One high-confidence destination identity exists. | Continue to verdict. |
| resolved_with_warnings | We found it, but metadata has caveats. | Continue for low-risk paths; require review for high-risk paths. |
| ambiguous | FQDN maps to multiple plausible owners/services/domains. | Block and ask for disambiguation. |
| unregistered_internal | Internal FQDN resolves but has no owner/classification. | Block high-risk access and create cleanup work. |
| external | FQDN is outside enterprise-owned zones. | Apply external/SaaS egress policy. |
| unresolvable | FQDN doesn't resolve in the relevant DNS view. | Block unless explicitly approved as future DNS. |
| wildcard_or_dynamic | Wildcard, CDN-backed, or highly dynamic destination. | Require special handling and tighter egress controls. |

We snapshot resolution at verdict time. If DNS, VIP, ownership, or compliance metadata changes later, assurance can replay the decision and tell us whether the original allow still makes sense.

---

<!-- Source: docs/metadata/metadata-and-tools.mdx -->

---
title: "Metadata And Existing Tools"
sidebar_position: 2
description: "How metadata moves and how ServiceNow and Prisma fit."
---

import MetadataFlowDiagram from '@site/src/components/diagrams/MetadataFlowDiagram';

# Metadata And Existing Tools

Metadata is the fuel for this platform. If metadata is bad, our verdicts are bad. We need enough context to decide, enough evidence to audit, and enough runtime data to catch drift.

## Metadata Flow

<MetadataFlowDiagram />

## ServiceNow ITAM

We should use ServiceNow ITAM as a partial asset and lifecycle source. It's useful for ownership hints, support groups, lifecycle state, business service relationships, cost center, and cleanup workflows. It won't see every Kubernetes workload or ephemeral cloud object, so we shouldn't treat it as complete runtime truth.

ServiceNow is also a good workflow destination. If we find an internal FQDN with no owner, a retired asset with active traffic, or conflicting ownership metadata, we can open the cleanup task there.

## Prisma

We should use Prisma as a public cloud inventory and posture source for AWS and GCP. It helps us see cloud resources, tags, security groups, load balancers, endpoints, exposure signals, and posture findings. We still need cloud-native sources like AWS Config, CloudTrail, VPC Flow Logs, GCP Cloud Asset Inventory, routes, and firewall logs for authoritative detail.

## Storage Boundary

This page is about metadata sources and flow. The durable Git write-back, Beacon control-plane record, and storage format are covered in [Control-Plane Records](../architecture/control-plane-records.md).

---

<!-- Source: docs/policy/verdicting.md -->

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

---

<!-- Source: docs/policy/pdp-service.md -->

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

---

<!-- Source: docs/policy/opa-policy-model.md -->

---
title: "OPA Policy Model"
sidebar_position: 3
description: "How Rego policy should be structured for Beacon verdicting."
---

# OPA Policy Model

OPA policy is owned centrally. App teams author implementation config; Beacon derives connectivity intent; platform, security, network, and destination owners maintain the policy that decides whether that derived intent is acceptable.

## Repository Layout

Keep policy in a dedicated repository:

```text
beacon-policy/
├── policy/
│   ├── enterprise/
│   │   ├── deny.rego
│   │   ├── ttl.rego
│   │   ├── data-class.rego
│   │   └── required-controls.rego
│   ├── destinations/
│   │   ├── payments.rego
│   │   ├── customer-data.rego
│   │   └── shared-platform.rego
│   └── exceptions/
│       └── exception.rego
├── data/
│   ├── compliance-zones.json
│   ├── control-matrix.json
│   └── approved-destinations.json
└── tests/
    ├── deny_test.rego
    ├── ttl_test.rego
    └── required-controls_test.rego
```

That repo builds signed OPA bundles. The Beacon PDP loads only signed, approved bundles.

## Policy Categories

| Category | Purpose |
| --- | --- |
| Enterprise deny rules | Non-negotiable conditions that block intent. |
| TTL policy | Maximum lifetime for access by environment, risk, and data class. |
| Control requirements | Which primary and transitive controls must carry the allow. |
| Destination owner policy | Rules owned by teams responsible for sensitive targets. |
| Exception policy | What must be present for temporary risk acceptance. |
| Completeness policy | Required metadata and confidence checks. |

## Input Shape

OPA evaluates the canonical enriched `NetworkIntent` envelope described in [Intent Model](../architecture/intent-model.md#beacon-enriched-intent). In the common path, that `NetworkIntent` is derived from Helm, Terraform, Kubernetes, mesh, or platform config. Beacon serializes the YAML-shaped object as JSON before sending it to the PDP.

That means policy should reference the same key hierarchy used by delivery checks and assurance:

| Policy Need | Canonical Field |
| --- | --- |
| Source workload | `input.spec.source.workloadId` |
| Source application identity | `input.spec.source.centralId` |
| Source environment | `input.spec.source.environment` |
| Source data classification | `input.spec.source.dataClassification` |
| Destination FQDN | `input.spec.destination.requestedFqdn` |
| Destination resolution status | `input.spec.destination.resolution.status` |
| Destination confidence | `input.spec.destination.resolution.confidence` |
| Destination owner | `input.spec.destination.ownerTeam` |
| Destination data classification | `input.spec.destination.dataClassification` |
| ServiceNow lifecycle | `input.spec.destination.serviceNow.lifecycleState` |
| Prisma findings | `input.spec.destination.prisma.postureFindings` |
| Requested TTL | `input.spec.lifecycle.requestedTtlDays` |
| Maximum TTL | `input.spec.lifecycle.maxAllowedTtlDays` |
| Inspection requirement | `input.spec.path.inspectionRequired` |
| Required transit controls | `input.spec.path.requiredTransitiveControls` |
| Exception ID | `input.spec.policyContext.exception.id` |
| Pull request | `input.spec.workflow.pullRequest` |

## Example Rego

This is the style of policy we want. The exact syntax can evolve, but the contract should stay simple: produce denies, TTL, control requirements, and an allow decision.

```rego
package beacon.verdict

default allow := false

deny contains {
  "id": "DESTINATION_UNRESOLVED",
  "message": "Destination FQDN could not be resolved to an owned service"
} {
  input.spec.destination.resolution.status != "resolved"
}

deny contains {
  "id": "PROD_REQUIRES_HIGH_CONFIDENCE",
  "message": "Production access requires high-confidence destination resolution"
} {
  input.spec.source.environment == "prod"
  input.spec.destination.resolution.confidence != "high"
}

deny contains {
  "id": "PUBLIC_TO_RESTRICTED_DENIED",
  "message": "Public-classified workloads cannot access restricted destinations"
} {
  input.spec.source.dataClassification == "public"
  input.spec.destination.dataClassification == "restricted"
}

deny contains {
  "id": "TTL_EXCEEDS_MAX",
  "message": sprintf("Requested TTL exceeds maximum allowed TTL of %d days", [max_ttl_days])
} {
  input.spec.lifecycle.requestedTtlDays > max_ttl_days
}

deny contains {
  "id": "DESTINATION_RETIRED",
  "message": "New connectivity cannot target a retired ServiceNow asset"
} {
  input.spec.destination.serviceNow.lifecycleState == "retired"
}

max_ttl_days := 30 {
  input.spec.destination.dataClassification == "restricted"
}

max_ttl_days := 90 {
  input.spec.source.environment == "prod"
  input.spec.destination.dataClassification != "restricted"
}

max_ttl_days := 180 {
  input.spec.source.environment != "prod"
}

primary_control := {
  "type": "istio-serviceentry",
  "owner": "platform-mesh",
  "target": sprintf("%s/%s", [input.spec.source.cluster, input.spec.source.namespace])
} {
  input.spec.source.cluster != ""
}

transitive_controls contains {
  "type": "palo-alto-inspection",
  "owner": "network-security",
  "target": "required-inspection-path"
} {
  input.spec.path.inspectionRequired
}

transitive_controls contains {
  "type": "destination-owner-approval",
  "owner": input.spec.destination.ownerTeam,
  "target": input.spec.destination.serviceId
} {
  input.spec.destination.dataClassification == "restricted"
}

controls := {
  "primary": primary_control,
  "transitive": transitive_controls
}

allow {
  count(deny) == 0
}
```

## Testing Expectations

Every policy change should include tests. We should test both the obvious denies and the quiet allows.

Examples:

- unresolved FQDN denies
- production low-confidence destination denies
- restricted destination requires short TTL
- restricted destination requires owner approval
- routes that require inspection include Palo Alto control
- dev/test gets a longer maximum TTL than production
- approved internal service path returns no denies

Policy should be treated like product code. It gets PR review, tests, signed bundles, and versioned releases.

---

<!-- Source: docs/policy/tool-responsibilities.md -->

---
title: "Tool Responsibilities"
sidebar_position: 2
description: "How OPA, Sentinel, Gatekeeper, GitHub, and TFE divide the work."
---

# Tool Responsibilities

We need the tools to complement each other. We don't want OPA, Sentinel, and Gatekeeper all trying to be the same policy engine.

| Tool | Job |
| --- | --- |
| GitHub Actions | Fast PR feedback. The Action extracts intent, computes implementation hash, calls Beacon, reports the verdict, and saves evidence artifacts. |
| Beacon Extractor | Derives canonical `NetworkIntent` from Helm values, Terraform, Kubernetes manifests, mesh config, or platform config. |
| Beacon PDP API | Managed decision service that wraps OPA, logs decisions, signs verdicts, and controls policy bundle versions. |
| OPA | Rego evaluation over enriched connectivity intent inside the Beacon PDP boundary. |
| Verdict Binding | Ties the signed verdict to the implementation hash that produced the derived intent. |
| Terraform Enterprise Sentinel | Terraform plan governance for cloud/provider-managed PEPs. |
| TFE OPA policy sets | Optional Rego reuse for Terraform plan checks, if we want it. |
| Gatekeeper | Kubernetes admission and audit to prevent unmanaged mesh/Kubernetes policy. |
| Prisma | Cloud inventory and posture signal, not the final network verdict. |
| ServiceNow ITAM | Asset/lifecycle context and cleanup workflow, not runtime truth by itself. |

## Boundary We Should Hold

Beacon PDP decides whether the derived intent is allowed using OPA behind the service boundary. Verdict binding proves the decision applies to the same implementation hash that produced the derived intent. Sentinel proves the Terraform plan carries a valid verdict and doesn't create broad, unmanaged controls. Gatekeeper blocks in-cluster bypass. Assurance tells us whether reality drifted.

---

<!-- Source: docs/delivery/deployment-flow.mdx -->

---
title: "Deployment Flow"
sidebar_position: 1
description: "How developer-owned implementation passes strict extraction, Beacon verdicting, and deployment."
---

import DeploymentFlowDiagram from '@site/src/components/diagrams/DeploymentFlowDiagram';

# Deployment Flow

The developer experience should feel like normal configuration as code. Developers write Helm, Terraform, Kubernetes, mesh, or platform config. Beacon strictly derives intent from that implementation and binds the verdict to the implementation hash before merge.

1. A team opens a GitHub PR with implementation config.
2. GitHub Actions detects supported Helm, Terraform, Kubernetes, mesh, or platform files.
3. The Beacon Action derives one or more `NetworkIntent` objects.
4. The destination resolver maps FQDNs to destination identity.
5. Metadata enrichment adds ownership, environment, tenant, compliance, asset, and cloud context.
6. The GitHub Action calls the managed Beacon PDP API.
7. The Beacon PDP evaluates OPA policy and returns an allow/deny verdict.
8. Beacon signs the verdict with the implementation hash that produced the derived intent.
9. Denies or extraction failures show up in the PR with rule IDs and remediation.
10. On merge, the developer-owned deployment pipeline applies the implementation.
11. Sentinel blocks Terraform plans that bypass approved modules or miss verdict metadata.
12. Gatekeeper blocks unmanaged Kubernetes and mesh resources.
13. Runtime collectors and assurance start checking drift.

<DeploymentFlowDiagram />

The dedicated PR integration details live in [GitHub Action Verdict](./github-action-verdict.md).

---

<!-- Source: docs/delivery/github-action-verdict.md -->

---
title: "GitHub Action Verdict"
sidebar_position: 2
description: "How developer PRs derive intent from implementation config and call Beacon for verdicting."
---

# GitHub Action Verdict

Developer teams interact with Beacon through a reusable GitHub Action or reusable workflow. They get a normal PR check without needing to understand OPA, metadata joins, or Beacon's internal data model.

## What The Action Does

The Action should stay thin. It finds changed implementation files, extracts one or more `NetworkIntent` objects, validates the result, computes the implementation hash, attaches repo context, calls Beacon, and posts allow/deny feedback.

The managed Beacon PDP service owns OPA evaluation and decision logging.

## Strict Extraction

Extraction is mandatory and fail-closed. If Beacon can't safely derive the full intent from the implementation, the PR fails before policy evaluation.

Strict extraction rules:

- unsupported implementation patterns fail
- wildcard hosts fail unless explicitly supported by policy
- CIDR-only destinations fail unless an approved FQDN or destination identity is present
- ambiguous source workload scope fails
- missing business justification or TTL fails
- one implementation file may produce multiple derived intents
- the extracted intent must be faithful to the implementation artifact

## Example Developer Workflow

```yaml
name: Beacon Connectivity

on:
  pull_request:
    paths:
      - "charts/**"
      - "terraform/**"
      - "k8s/**"
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
          implementation-paths: charts,terraform,k8s
          optional-intent-path: network-intents
          beacon-url: https://beacon.company.com
          output-path: .beacon
```

The Action can authenticate to Beacon using OIDC. That lets Beacon know which repo, branch, and workflow identity made the request without storing long-lived tokens in app repositories.

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

On allow, the Action should avoid noisy comments by default. The check summary should include decision ID, policy bundle, controls, expiration, extraction status, implementation hash, and derived intent summary.

## Workflow Artifacts

The Action should save derived intent, verdict, extraction output, and implementation hash as workflow artifacts. These are evidence artifacts, not implementation artifacts generated by Beacon.

```text
.beacon/
├── derived-intents/
│   └── orders-api-payments-443.yaml
├── verdicts/
│   └── orders-api-payments-443.json
└── extraction/
    └── orders-api-payments-443.json
```

The developer-owned deployment pipeline can consume the signed verdict and implementation hash, but it still applies the team's Helm/Terraform/Kubernetes implementation. Beacon doesn't render the implementation for them.

---

<!-- Source: docs/assurance/assurance-model.mdx -->

---
title: "Assurance Model"
sidebar_position: 1
description: "How we prove runtime still matches intent."
---

import AssuranceModelDiagram from '@site/src/components/diagrams/AssuranceModelDiagram';

# Assurance Model

Assurance is how we keep this from becoming another write-only policy system.

We need to compare five states:

1. **Implementation Source**: what the team wrote in Helm, Terraform, Kubernetes, mesh, or platform config.
2. **Derived Intent**: what `NetworkIntent` Beacon extracted from that implementation.
3. **Approved Verdict**: what Beacon PDP allowed and under which OPA policy bundle.
4. **Deployed State**: what the PEPs actually contain.
5. **Observed Runtime**: what traffic, logs, routes, and telemetry show.

<AssuranceModelDiagram />

## Findings We Care About

- deployed rule with no derived intent
- deployed implementation hash that doesn't match the signed verdict
- approved derived intent not deployed
- observed flow with no current verdict
- expired verdict still active
- FQDN now resolves to a different owner, VIP, or compliance domain
- route bypasses required Palo Alto inspection
- endpoint policy or SG is broader than approved derived intent
- ServiceNow says an asset is retired but traffic is still active
- Prisma sees a risky exposure tied to an approved path

The practical audit question is: **is this connection allowed because we intended it, or because something drifted?**

---

<!-- Source: docs/reference/source-anchors.md -->

---
title: "Source Anchors"
sidebar_position: 1
description: "Reference links and source artifact note."
---

# Source Anchors

Useful references:

- GitHub Actions enterprise CI/CD: https://docs.github.com/en/enterprise-cloud@latest/actions/get-started/understand-github-actions
- HashiCorp Sentinel: https://developer.hashicorp.com/sentinel/docs
- Terraform Enterprise policy enforcement: https://developer.hashicorp.com/terraform/enterprise/policy-enforcement
- OPA Gatekeeper: https://open-policy-agent.github.io/gatekeeper/website/docs/
- Open Policy Agent decision logs: https://www.openpolicyagent.org/docs/management-decision-logs
- Kubernetes ValidatingAdmissionPolicy: https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/
- Istio ServiceEntry: https://istio.io/latest/docs/reference/config/networking/service-entry/
- AWS VPC endpoint policies: https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-access.html
- AWS Firewall Manager security group policies: https://docs.aws.amazon.com/waf/latest/developerguide/security-group-policies.html
- AWS Reachability Analyzer: https://docs.aws.amazon.com/vpc/latest/reachability/what-is-reachability-analyzer.html
- GCP hierarchical firewall policies: https://cloud.google.com/firewall/docs/firewall-policies
- Palo Alto PAN-OS APIs and SDKs: https://pan.dev/panos/docs/
- Illumio labels and workload APIs: https://product-docs-repo.illumio.com/Tech-Docs/Core/25.4/REST-APIs/out/en/rest-apis-25-4/security-policy-objects/labels.html
