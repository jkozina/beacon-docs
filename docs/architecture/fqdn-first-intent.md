---
title: "FQDN-First Intent"
sidebar_position: 3
description: "How developers declare connectivity without needing destination internals."
---

# FQDN-First Intent

We shouldn't expect developers to know the destination's owner, compliance domain, VIP, PSC attachment, Illumio labels, or Palo Alto path. They usually know the FQDN they need to call. That's enough to start.

## Developer-Written Intent

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

## Enriched Decision Input

Before the Policy Decision Point (PDP) sees the request, we enrich it with source and destination context:

- source central ID, owner, environment, tenant, compliance domain, trust zone
- destination service ID, owner, VIP, environment, tenant, compliance domain, trust zone
- resolution confidence and source systems
- required transitive path
- destination-owner explicit deny policy
- repo, commit, PR, workflow run, TFE workspace, and ticket metadata

This keeps the developer interface small while keeping the policy decision rich.

## Fully Enriched Version

This is the shape we want the platform to produce internally after source lookup, destination resolution, ServiceNow/Prisma enrichment, and policy-context assembly. Developers shouldn't have to write most of this by hand.

```yaml
apiVersion: network.company.com/v1
kind: NetworkIntent
metadata:
  name: orders-to-payments
  namespace: orders
  annotations:
    network.company.com/source-repo: github.company.com/retail/orders-api
    network.company.com/source-commit: 8f2c1ab
    network.company.com/pull-request: "1247"
    network.company.com/workflow-run-id: "982344102"
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
    serviceNow:
      businessService: Retail Ordering
      assetRecord: SN-ASSET-100233
      lifecycleState: active
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
  path:
    preferredPrimaryControl: istio-service-entry
    expectedPrimaryControls:
      - istio-service-entry
    requiredTransitiveControls:
      - equinix-pa
      - onprem-fabric-pa
      - illumio
    inspectionRequired: true
  purpose:
    businessJustification: Submit payment authorization requests
    ticket: CHG123456
    requestedBy: jane.engineer
    dataTypes:
      - payment_token
  lifecycle:
    requestedTtlDays: 365
    expiresAt: "2027-05-03"
  policyContext:
    policyBundle: network-policy-bundle:v2026.05.03
    evaluationMode: enforce
    exception:
      id: null
```

In practice, we'd probably store the enriched object as a verdict input record rather than writing the whole thing back into the app repo. The important part is that the verdict is made against this enriched shape, not against the small developer-authored request alone.
