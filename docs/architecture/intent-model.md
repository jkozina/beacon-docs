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
