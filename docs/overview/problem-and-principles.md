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
7. **Assurance is part of the design.** We don't stop at deployment. We prove runtime still matches approved intent.
