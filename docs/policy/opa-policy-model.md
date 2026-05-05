---
title: "OPA Policy Model"
sidebar_position: 3
description: "How Rego policy should be structured for Beacon verdicting."
---

# OPA Policy Model

OPA policy is owned centrally. App teams declare connectivity intent; platform, security, network, and destination owners maintain the policy that decides whether that intent is acceptable.

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

OPA evaluates the canonical enriched `NetworkIntent` envelope described in [Intent Model](../architecture/intent-model.md#beacon-enriched-intent). In practice, Beacon serializes that YAML-shaped object as JSON before sending it to the PDP.

That means policy should reference the same key hierarchy used by controllers, compilers, and assurance:

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
