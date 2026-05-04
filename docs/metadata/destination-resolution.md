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
