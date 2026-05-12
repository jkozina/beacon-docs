---
title: "Beacon MVP / Charter Pitch — Build Specification"
description: "Buildable spec for a charter-alignment POC of Beacon, the Enterprise Connectivity Control Plane."
sidebar_label: "Beacon MVP Build Spec"
---

# Beacon MVP / Charter Pitch — Build Specification

| | |
| --- | --- |
| **Status** | Approved design, ready to build |
| **Author** | John Kozina, Director, Network Security |
| **Date** | 2026-05-11 |
| **Spec horizon** | ~2 weeks part-time build; one 12-minute pitch slot |
| **Pitch goal** | Charter alignment from a cross-functional steering group (network security, platform, application DX, plus leaders from each domain) on the Beacon model as described in the Beacon docs site — exiting the meeting with a working group, a funding decision target date, named integration clearances, and a named pilot team |

## 0. Context and Goal

Beacon, as described in this docs site, is an Enterprise Connectivity Control Plane. It derives canonical `NetworkIntent` from developer-authored implementation config (Helm values, Terraform, Kubernetes manifests, mesh config, platform config), resolves the destination, enriches the request with enterprise metadata, evaluates centrally-owned policy via a managed PDP service wrapping OPA, signs the verdict, binds it to the implementation hash, and continuously assures that runtime matches approved intent. None of this exists yet.

This specification defines a buildable POC whose three jobs are:

1. **Close the loop visibly end-to-end** on a real PR. Extraction, resolution (stubbed via fixtures), enrichment (stubbed via fixtures), real OPA verdict, real Ed25519 signature, real PR feedback, real durable write-back to the developer repo. No mock JSON, no faked screenshots.
2. **Produce four durable artifacts that survive the pitch.** A `beacon-app` service, a signed `beacon-policy` bundle, a composite `beacon-action`, and a `retail-orders` demo repo. Each maps onto an owning team in the funded build; nothing here is throwaway scaffolding.
3. **Defuse the "won't work" objection from each constituency in the room** by making the failure surface and stubbed components visible rather than papered over. The pitch's credibility depends on the honesty of its "what's stubbed" slide.

### In scope

The live PR-check loop, signed allow verdict, signed deny verdict, fail-closed extraction path, durable approved-NetworkIntent write-back to the app repo, signature verification on the consumer side.

### Out of scope, declared

The assurance reconciler, TFE Sentinel and Gatekeeper bypass enforcement, the exception PDP flow, multi-cluster or multi-platform fixtures beyond what one allow and one deny require, the destination-owner policy contribution pipeline, decision-log persistence beyond stdout, the Beacon control-plane database, and the assurance graph. These are surfaced in the pitch deck under "what the funded build owns."

## 1. Architecture and Repository Layout

Four repositories, each owning a single responsibility that mirrors the production ownership boundary. After the pitch, each repository has a natural home with its owning team.

### 1.1 Repository structure

```text
beacon-app/                # eventual owner: network-security / platform
  Dockerfile               # builds the sidecar image
  api/
    server.py              # FastAPI: POST /v1/verdict
  orchestrator/
    pipeline.py            # coordinates resolve -> enrich -> verdict -> sign
  resolver/
    resolver.py            # FQDN -> destination identity (fixture-backed)
  enricher/
    enricher.py            # joins source + destination metadata; produces canonical enriched NetworkIntent
  pdp/
    opa_runner.py          # invokes `opa eval` against the bundled policy
  signer/
    signer.py              # Ed25519 over canonical verdict JSON
  keys/                    # demo key (gitignored; loaded from secret at run time)
  bundle/                  # baked-in copy of the signed policy bundle
  fixtures/
    destinations/
      payments-api.prod.company.internal.json
    sources/
      orders.json
  README.md

beacon-policy/             # eventual owner: policy authors (network-security + appsec)
  policy/
    enterprise/
      deny.rego            # destination unresolved, retired asset, ownership missing
      ttl.rego             # TTL tiers by data classification + environment
      controls.rego        # primary + transitive control requirements
    destinations/
      payments.rego        # destination-owner rules for the demo target
  data/
    compliance-zones.json
    approved-destinations.json
  tests/
    deny_test.rego
    ttl_test.rego
    controls_test.rego
  Makefile                 # opa test && opa build --signing-key

beacon-action/             # eventual owner: platform / DevEx
  action.yml               # composite action entrypoint
  scripts/
    extract.py             # Helm values.yaml -> derived NetworkIntent + impl hash
    call_pdp.py            # builds request, POSTs to sidecar, parses verdict
    post_comment.py        # renders markdown PR comment from verdict
    write_back.py          # renders approved NetworkIntent, commits to PR branch
  keys/
    beacon-verdict.pub     # Beacon verdict-signing public key for consumer-side verify
  README.md

retail-orders/             # eventual owner: the surrogate app team
  charts/orders/values.yaml
  .github/workflows/beacon.yml
  branches:
    feat/payments-happy-path     # allow: ttl 30 days, restricted destination, ok
    feat/payments-too-long-ttl   # deny:  ttl 120 days -> TTL_EXCEEDS_MAX
    feat/wildcard-host           # deny:  extraction-failure path (optional live)
```

### 1.2 Boundaries

| Boundary | What it owns |
| --- | --- |
| Developer repo (`retail-orders`) | Implementation config (Helm values), the approved-NetworkIntent write-back artifact after a Beacon allow, the workflow file that calls the Action |
| Composite Action (`beacon-action`) | Detecting changed implementation files, extracting derived intent, computing implementation hash, calling the Beacon API, verifying the verdict signature, rendering PR feedback, persisting evidence artifacts, write-back |
| Beacon API (`beacon-app`) | Destination resolution, metadata enrichment, OPA evaluation, verdict signing, bundle integrity, full canonical input assembly |
| Policy bundle (`beacon-policy`) | Rego rules, fixture data, bundle build pipeline, bundle signing |

### 1.3 Demo-time compromises declared

These are honest reductions from the production model. Each is called out in the pitch under "what's stubbed":

| Compromise | POC | Production graduation |
| --- | --- | --- |
| All four repos under one GitHub user | Single ownership | Migrate to the respective owning org with branch protection and code-owner review |
| Policy bundle baked into `beacon-app` Docker image | Deterministic sidecar boot, no network at workflow time | `beacon-app` periodically pulls signed bundles from an OCI registry; signature verified on load |
| Enrichment from fixture files | One source fixture, one destination fixture | Live joins across DNS, IPAM, ServiceNow ITAM, Prisma, K8s/OpenShift ingress, AWS/GCP APIs, Illumio, service catalog |
| Destination resolution from fixture | One canonical destination identity | Resolver microservice correlating DNS, IPAM, K8s ingress, cloud private endpoints, ServiceNow lifecycle |
| Verdict signing with a local Ed25519 key | Key on disk in the sidecar; public key shipped with the Action | HSM- or KMS-backed signing; public key published via `GET /v1/keys` with rotation |
| One Helm extractor only | `egress.allow[]` shape in `charts/**/values.yaml` | Extractors for Helm, Terraform, Kubernetes manifests, Kustomize overlays, Istio mesh config, platform config |
| Decision logs to stdout | Readable in workflow logs | Append-only decision-log store with replay API |
| `github-actions[bot]` for the write-back commit | Zero setup | A dedicated Beacon bot identity with code-owner exemption |

## 2. Component Contracts

The boundary that matters most is the Action ↔ Beacon API contract. The Action is a thin client: it sends what the developer authored plus PR provenance. Beacon does resolution, enrichment, verdict, and signing internally, mirroring what the production Kubernetes-hosted Beacon application will do.

### 2.1 `POST /v1/verdict` — request

The Action sends this. No enrichment, no canonical envelope, no metadata snapshot.

```json
{
  "derivedIntent": {
    "apiVersion": "network.company.com/v1",
    "kind": "NetworkIntent",
    "metadata": { "name": "orders-to-payments" },
    "spec": {
      "source": {
        "workloadId": "orders-api",
        "namespace": "orders",
        "serviceAccount": "orders-api"
      },
      "destination": { "fqdn": "payments-api.prod.company.internal" },
      "traffic": {
        "protocol": "TCP",
        "port": 443,
        "applicationProtocol": "HTTPS"
      },
      "purpose": {
        "businessJustification": "Submit payment authorization requests",
        "ticket": "CHG123456"
      },
      "lifecycle": { "requestedTtlDays": 30 }
    }
  },
  "implementationContext": {
    "hash": "sha256:31a8c1f4a6c0c4f2b9d5a81d92e36f9b6a0f2d9e9b8b0b2a8b16d3a7d6f91ad7",
    "repository": "retail/retail-orders",
    "pullRequest": 1259,
    "commit": "91c7e5d",
    "actor": "jane.engineer",
    "workflowRunId": "982901771",
    "implementationFiles": ["charts/orders/values.yaml"]
  },
  "policyMode": "enforce"
}
```

### 2.2 `POST /v1/verdict` — response

The full envelope. Beacon embeds `canonicalRequest` and `enrichmentSnapshot` so the Action has everything it needs without a second API call. This is also how the production verdict-binding step gets a single piece of evidence for downstream consumers.

```json
{
  "decisionId": "dec-018f7d2f",
  "allow": true,
  "policyBundle": "beacon-policy:v2026.05.03",
  "evaluatedAt": "2026-05-03T18:42:22Z",
  "expiresAt": "2026-06-02T00:00:00Z",
  "implementationHash": "sha256:31a8...",
  "metadataSnapshotHash": "sha256:7e2b...",
  "denyReasons": [],
  "matchedRules": [
    "TTL_RESTRICTED_DESTINATION_MAX_30D",
    "PCI_DESTINATION_REQUIRES_INSPECTION",
    "RESTRICTED_DESTINATION_REQUIRES_OWNER_POLICY"
  ],
  "controls": {
    "primary": {
      "type": "istio-service-entry",
      "owner": "platform-mesh",
      "target": "eks-prod-use1-retail-a/orders"
    },
    "transitive": [
      { "type": "equinix-pa", "owner": "network-security", "target": "hybrid-egress" },
      { "type": "onprem-fabric-pa", "owner": "network-security", "target": "pci-datacenter-edge" },
      { "type": "illumio", "owner": "segmentation", "target": "payments-workload-policy" },
      { "type": "destination-owner-approval", "owner": "team-payments", "target": "app-payments-api" }
    ]
  },
  "canonicalRequest": {
    "...": "the full enriched NetworkIntent that OPA evaluated; shape from intent-model.md"
  },
  "enrichmentSnapshot": {
    "...": "the joined source + destination metadata, kept for audit"
  },
  "signature": "beacon-signature:v1:MEUCIQD..."
}
```

A signed **deny** has the same shape with `allow: false`, populated `denyReasons[]`, and possibly empty `controls`. A signed deny is just as auditable as a signed allow; both feed the assurance loop in production. Only system failures produce no verdict.

### 2.3 Internal flow behind `/v1/verdict`

```text
POST /v1/verdict
  |
  +-- resolver.resolve(fqdn, source)
  |     loads fixtures/destinations/<fqdn>.json
  |     -> destinationIdentity, confidence, resolution sources
  |
  +-- enricher.enrich(intent, destinationIdentity, source)
  |     joins source + destination metadata fixtures
  |     builds the canonical enriched NetworkIntent
  |     -> enrichedIntent, metadataSnapshotHash
  |
  +-- pdp.evaluate(enrichedIntent)
  |     opa eval --bundle ./bundle --input <canonical>.json data.beacon.verdict
  |     -> allow, deny[], controls, ttl, matchedRules
  |
  +-- signer.sign(verdict)
  |     canonical-JSON serialize, Ed25519 sign with demo key
  |     -> signature
  |
  +-- return Verdict envelope
```

Each Beacon-app subpackage maps onto a future module or microservice:

| Subpackage | Responsibility | Production graduation |
| --- | --- | --- |
| `api/` | FastAPI HTTP server, request and response shaping | Ingress + API gateway in Kubernetes |
| `resolver/` | FQDN to destination identity, fixture-backed in the POC | Resolver microservice with live DNS, IPAM, K8s, cloud, and Prisma clients |
| `enricher/` | Metadata joins, fixture-backed in the POC | Enrichment service with ServiceNow, Prisma, K8s, cloud adapters |
| `pdp/` | OPA wrapper, decision logging | PDP service with embedded OPA and a decision-log writer |
| `signer/` | Verdict signing | Signing service backed by HSM or KMS |
| `orchestrator/` | Coordinates resolve, enrich, verdict, sign | Workflow engine or service mesh of the four above |

### 2.4 Implementation hash

The Action computes the implementation hash as `sha256` of the canonical bytes of all extracted implementation files:

1. Collect all files matched by the extractor.
2. Sort by repository-relative path, lexicographic.
3. For each file: normalize line endings to LF, hash the bytes, encode as hex.
4. Concatenate `path + ":" + filehash + "\n"` over all files.
5. Hash that bytes string. Prefix with `sha256:`.

The Action sends the hash in `implementationContext.hash`. Beacon binds the same value into the signed verdict as `implementationHash`. Downstream consumers (Sentinel, Gatekeeper, the assurance reconciler) recompute the hash over the same files and verify the signature to prove the implementation being deployed is the one Beacon approved.

### 2.5 Policy bundle

`beacon-policy/Makefile`:

```makefile
test:
	opa test policy/ tests/

build: test
	opa build \
	  --signing-key keys/bundle-signing.pem \
	  --bundle policy \
	  --bundle data \
	  --output build/bundle.tar.gz
```

`build/bundle.tar.gz` is committed to `beacon-policy` releases (or pushed as an OCI artifact). For the POC, the `beacon-app` Dockerfile copies the bundle into the image at build time and pins the bundle revision in an image label.

The Beacon app verifies the bundle signature at startup using a baked public key. If the signature fails or the bundle is missing, the sidecar exits non-zero and the workflow service step fails — the Action then sees a connection-refused at `localhost:8181` and fails closed.

## 3. Data Flow

### 3.1 Workflow file in `retail-orders`

```yaml
# .github/workflows/beacon.yml
name: Beacon Connectivity

on:
  pull_request:
    paths:
      - "charts/**"
      - "terraform/**"
      - "k8s/**"

permissions:
  contents: write          # required for write-back commit
  pull-requests: write

jobs:
  verdict:
    runs-on: ubuntu-latest
    services:
      beacon-app:
        image: ghcr.io/<owner>/beacon-app:demo
        ports: ["8181:8181"]
        env:
          BUNDLE_REVISION: "v2026.05.03"
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0       # needed for diff against base
      - uses: <owner>/beacon-action@v1
        with:
          beacon-url: http://localhost:8181
          implementation-paths: charts,terraform,k8s
```

This file is the artifact the platform team will scrutinize hardest. It is short, secret-free, has no external hosting dependencies, and its mental model fits on one screen.

### 3.2 Happy-path PR: `feat/payments-happy-path`

Added to `charts/orders/values.yaml`:

```yaml
egress:
  allow:
    - name: payments
      host: payments-api.prod.company.internal
      port: 443
      protocol: HTTPS
      justification: Submit payment authorization requests
      ticket: CHG123456
      ttlDays: 30
```

| # | Where | What happens |
| --- | --- | --- |
| 1 | GitHub | Developer pushes branch, opens PR. `pull_request` event fires. |
| 2 | GHA runner | `beacon-app` container starts as a service, loads and verifies the baked policy bundle, opens `:8181`. |
| 3 | `actions/checkout` | Repository checked out with full history. |
| 4 | `beacon-action` — detect | `git diff --name-only origin/main...HEAD` filtered against `implementation-paths`. Output: `charts/orders/values.yaml`. |
| 5 | `beacon-action` — extract | `extract.py` parses `values.yaml`, walks `egress.allow[]`, emits one derived NetworkIntent. Computes `implementationHash` per Section 2.4. Writes `.beacon/derived-intents/orders-to-payments.json`. |
| 6 | `beacon-action` — assemble | `call_pdp.py` builds the `/v1/verdict` request body (Section 2.1). |
| 7 | `beacon-action` — POST | `POST http://localhost:8181/v1/verdict`. Workflow log shows the request. |
| 8 | `beacon-app` — resolve | Resolver loads `fixtures/destinations/payments-api.prod.company.internal.json`. Returns canonical identity: `app-payments-api`, PCI, restricted, OpenShift cluster, owner `team-payments`. |
| 9 | `beacon-app` — enrich | Enricher loads source fixture for `orders-api` namespace (EKS cluster, `team-orders`, non-pci, intranet-app). Joins with destination. Produces the canonical enriched NetworkIntent. Computes `metadataSnapshotHash`. |
| 10 | `beacon-app` — evaluate | `opa eval --bundle ./bundle --input <canonical>.json data.beacon.verdict`. Returns `deny: []`, `allow: true`, `ttl: 30`, controls (Istio primary plus four transitives), matched rules. |
| 11 | `beacon-app` — sign | Canonical-JSON serialize the verdict, Ed25519 sign with the demo key, attach signature. |
| 12 | `beacon-app` — respond | Returns the full envelope (verdict + canonicalRequest + enrichmentSnapshot). |
| 13 | `beacon-action` — verify | Verifies the verdict signature using `keys/beacon-verdict.pub`. Aborts with system-error if verification fails. |
| 14 | `beacon-action` — persist | Writes `.beacon/verdicts/orders-to-payments.json`, `.beacon/canonical/orders-to-payments.json`, `.beacon/enrichment/orders-to-payments.json`, `.beacon/extraction/orders-to-payments.json`. |
| 15 | `beacon-action` — comment | `post_comment.py` renders markdown from the verdict; `gh pr comment --edit-last` posts or updates. |
| 16 | `beacon-action` — upload | `actions/upload-artifact@v4` uploads `.beacon/` as `beacon-evidence`. |
| 17 | `beacon-action` — write-back (allow only) | Renders the approved NetworkIntent YAML per Appendix C, writes `.beacon/approvals/orders-to-payments.yaml`, `git add && git commit && git push`. Path is outside `paths:` so it does not refire the workflow. |
| 18 | GHA | Check turns green; PR is mergeable. |

### 3.3 Deny path: `feat/payments-too-long-ttl`

Same diff but `ttlDays: 120`. Steps 1–13 are identical except OPA returns `deny: [{ id: "TTL_EXCEEDS_MAX", message: "..." }]` and `allow: false`. The verdict is still signed. Step 15 renders the deny comment (Appendix A.2). **Step 17 is skipped** — no write-back happens on deny. Step 18 sets the check to `failure`. Branch protection blocks the merge button.

### 3.4 Workflow artifacts

When the audience clicks "Artifacts" on the workflow run, they download `beacon-evidence.zip`:

```text
.beacon/
├── derived-intents/
│   └── orders-to-payments.json
├── canonical/
│   └── orders-to-payments.json       # the enriched NetworkIntent OPA evaluated
├── enrichment/
│   └── orders-to-payments.json       # the joined metadata snapshot
├── verdicts/
│   └── orders-to-payments.json       # signed verdict
└── extraction/
    └── orders-to-payments.json       # extractor status and diagnostics
```

Five JSON files telling the full story of one decision. These are also the screenshots in the deck.

### 3.5 The write-back artifact

The file written to `.beacon/approvals/<name>.yaml` is the partial-enriched approved NetworkIntent described in `docs/architecture/control-plane-records.md`. It contains:

- `metadata` (name, namespace, central-id label, decision-id annotation)
- `spec.source` — workload identity and ownership (no ServiceNow or Prisma detail)
- `spec.destination` — canonical destination identity (no `resolution.sources`, no Prisma findings, no `ownerPolicy`)
- `spec.traffic` — protocol, port, SNI, TLS requirement
- `spec.purpose` — justification, ticket, requester, data types
- `spec.lifecycle` — requested TTL, max allowed TTL, `expiresAt`
- `spec.approval` — decisionId, allow, policyBundle, evaluatedAt, expiresAt, controls (primary + transitive), matchedRules, metadataSnapshotHash, signature

The full enriched intent stays in Beacon. The write-back is the stable, signed, durable, dev-readable approval evidence.

A complete example is in Appendix C.

### 3.6 Multi-intent support

The Action and Beacon API support multiple intents per PR. The extractor emits an array; `call_pdp.py` calls `/v1/verdict` once per intent; the comment renders a table; the write-back writes one approved-NetworkIntent file per allowed intent. For the demo, each PR contains exactly one `egress.allow` entry — one intent, one verdict, sharper narrative.

## 4. Failure Modes and Fail-Closed Behavior

The contract everything hangs on: **no allow without a valid signed verdict bound to a current implementation hash.** Every failure short of a clean signed allow → check fails, no merge, developer gets actionable feedback.

### 4.1 Failure classes

| Class | Examples | Beacon response | PR-visible behavior |
| --- | --- | --- | --- |
| **Extraction** (developer-fixable) | Wildcard host, CIDR-only destination, missing justification, ambiguous source scope | Action emits `extraction.status: failed` with reason. **No PDP call is made.** | Check red. Comment: "Extraction failed: …" with file path, reason, fix guidance |
| **Resolution** (developer or owner fixable) | FQDN unresolvable, ambiguous, unregistered internal, retired ServiceNow asset | Beacon returns `allow: false`, signed, with `denyReasons: [DESTINATION_UNRESOLVED]` etc. | Check red. Deny comment with rule ID and remediation |
| **Policy** (developer or owner fixable) | TTL exceeds max, missing required control, public to restricted, low confidence | Beacon returns `allow: false`, signed, with `denyReasons` | Check red. Deny comment |
| **System** (Beacon-owned) | Sidecar did not start, bundle signature failed, OPA crash, signing key unavailable, verdict signature unverifiable on consumer side | Action emits `system_error`, fails the check, posts system-error comment | Check red. Comment: "Beacon system error — cannot verdict. Cannot allow without a valid signed verdict." |

### 4.2 Demo-visible failure paths

**1. Extraction failure — live (optional third PR).** Branch `feat/wildcard-host` adds:

```yaml
egress:
  allow:
    - host: "*.legacy.example.com"
      port: 443
```

Extractor returns `extraction.status: unsupported_implementation`, reason `wildcard_host_not_permitted`. No PDP call. Check red within seconds. This is the rule from `docs/delivery/github-action-verdict.md` made visible. Run live if Phase 4 finishes on time; cut to screenshot otherwise.

**2. PDP unavailable — captured screenshot.** One-off run with the sidecar removed. `call_pdp.py` connection-refused. Comment shown in Appendix A.3.

**3. Bundle signature invalid — captured screenshot.** One-off run with the baked bundle tampered. Sidecar refuses to start; container log shows `bundle signature verification failed; refusing to serve verdicts`. Action sees connection-refused at `:8181`. Same system-error comment.

### 4.3 Consumer-side signature verification

The Action re-verifies the verdict signature using `keys/beacon-verdict.pub` before posting any comment. A signed-but-tampered verdict is treated as a system error. The trust boundary is not a handshake; the consumer enforces it.

Production: same key, distributed via `GET /v1/keys` with rotation. POC: static file in the Action.

### 4.4 Failure modes called out as out of scope

Real failure modes the funded build owns, deliberately not in scope here:

- Bundle revision drift between verdict time and deploy time
- Beacon API backpressure and rate-limiting
- GitHub PR comment rate limits at scale (thousands of repositories)
- Implementation hash collisions across multi-file PRs with overlapping changes
- Workflow re-run idempotency when a PR is force-pushed

Surfaced in the deck slide titled "What the funded build owns."

## 5. Build Sequence

Five phases over approximately 19 hours of part-time work across two weeks. Built vertically — get one thing end-to-end at minimum fidelity first, then add features.

### Phase 1 — Vertical smoke test (~4 hrs)

One Rego rule, one fixture, real OPA evaluation, hand-call the API. No GitHub Action yet.

| Task | Hrs |
| --- | --- |
| `beacon-policy`: one rule (`TTL_EXCEEDS_MAX`), one fixture, one test, `opa test` green, `opa build` | 1.0 |
| `beacon-app`: FastAPI skeleton, `POST /v1/verdict` that returns a hardcoded allow | 0.5 |
| Wire `opa_runner.py` to invoke `opa eval` against the built bundle | 1.0 |
| Stub `resolver.py` and `enricher.py` returning canned objects | 1.0 |
| Dockerfile + bake bundle; `docker run`; `curl localhost:8181/v1/verdict` returns a real OPA verdict | 0.5 |

**Exit:** `curl -d @sample.json localhost:8181/v1/verdict` returns a real OPA-evaluated, structured verdict. No signing yet. The spine works.

### Phase 2 — GitHub Action wrapper (~4 hrs)

| Task | Hrs |
| --- | --- |
| `beacon-action/action.yml` composite skeleton with inputs | 0.5 |
| `extract.py`: parse `egress.allow[]` shape; emit derived NetworkIntent JSON | 1.0 |
| Implementation hash computation per Section 2.4 | 0.5 |
| `call_pdp.py`: assemble request, POST, save verdict | 0.5 |
| `post_comment.py`: render allow comment; `gh pr comment --edit-last` | 1.0 |
| `retail-orders`: workflow file, one Helm values, one PR branch | 0.5 |

**Exit:** Open the happy-path PR. Workflow runs. PR gets an allow comment. Workflow log shows the POST. Check green.

### Phase 3 — Signing, write-back, artifacts (~4 hrs)

| Task | Hrs |
| --- | --- |
| `signer.py`: Ed25519 keypair, canonical-JSON serialize and sign, attach signature | 1.0 |
| Consumer-side signature verification in the Action | 0.5 |
| `actions/upload-artifact@v4`: package `.beacon/` as `beacon-evidence` | 0.5 |
| `write_back.py`: render approved-NetworkIntent YAML, commit, push | 1.0 |
| Bundle signature verification at sidecar startup; fail-fast on bad signature | 1.0 |

**Exit:** The happy-path PR now produces a signed verdict, a follow-on commit adding `.beacon/approvals/orders-to-payments.yaml`, and a `beacon-evidence` artifact.

### Phase 4 — Deny path, fixtures, breadth (~4 hrs)

| Task | Hrs |
| --- | --- |
| Add 4 more Rego rules (control requirements, data class, ownership, owner policy); tests | 1.5 |
| Deny comment rendering with rule ID, remediation, ticket pointer | 0.5 |
| Deny PR branch (`ttlDays: 120`); verify red check | 0.5 |
| Second enrichment fixture (e.g., `customers-api`) showing more than one destination | 0.5 |
| Extraction-failure path: wildcard-host PR; `extraction.status: failed`; no PDP call | 1.0 |

**Exit:** Three live PR scenarios: allow, deny-by-policy, deny-by-extraction.

### Phase 5 — Rehearsal, screen capture, deck artifacts (~3 hrs)

| Task | Hrs |
| --- | --- |
| Full dry run on the pitch laptop | 0.5 |
| Screen recordings of each scenario as backup | 0.5 |
| Screenshots of system-error scenarios (PDP unavailable, bundle invalid) | 0.5 |
| Static artifacts for the deck (Beacon control-plane record, assurance drift finding) generated by hand-running CLI scripts | 1.0 |
| Talking-points cue cards aligned to slide order | 0.5 |

**Exit:** You can demo the full story cold, on the pitch laptop, in under 12 minutes with 5 minutes of slack.

### Cut lines

If behind schedule:

- Skip the second enrichment fixture (one destination is enough)
- Skip consumer-side signature verification (call out as future work)
- Skip the live wildcard-host PR (use a screenshot)

### Pre-build readiness checklist

Verify before Phase 1:

- Docker available on the laptop; GitHub Container Registry account configured
- A GitHub account or organization under which the four demo repos can live
- Branch protection settings on `retail-orders` accept the Beacon check as required
- OPA binary version pinned (e.g., `opa_0.66.0`) and reproducible between laptop and Action runner

## 6. Demo Script and Narrative Arc

A beat sheet, not a script. Times are targets, narration is cue-card level. Target total: 12 minutes, leaving 8 minutes of a 20-minute slot for the discussion you actually want.

### 6.1 Arc

```text
Problem -> Model -> Live: allow -> Live: deny -> Artifacts/honesty -> The ask
  1 min    1 min      3 min          2 min            3 min            2 min
```

### 6.2 Beat sheet

| # | Time | On screen | Narration cue | Audience |
| --- | --- | --- | --- | --- |
| 1 | 0:00–1:00 | Slide: seven enforcement points (mesh, SGs, VPC endpoint, GWLB Palo, Equinix Palo, on-prem fabric, Illumio) with a red squiggle showing one connection crossing them | "One connection from orders to payments crosses seven controls. Owned by four teams. Approved by three change processes. We do this thousands of times a year." | All |
| 2 | 1:00–2:00 | Slide: the executive-model diagram from the docs | "We can't change physics — controls have to exist. We can change the operating model. Intent at the source. Stable corridors in transit. Verdict early, bound to implementation. Continuous assurance. That's Beacon." | All |
| 3 | 2:00–2:20 | Browser: `retail/retail-orders` in GitHub | "An app team owns this repo. They author Helm values. They never write a NetworkIntent." | App DX |
| 4 | 2:20–2:40 | Click into PR `feat/payments-happy-path`. Files Changed view showing the 7-line `egress.allow` block | "This is the diff. Seven lines. Connectivity to payments for 30 days, with a ticket and a justification." | App DX |
| 5 | 2:40–3:30 | Check goes Queued → In Progress → green; switch to workflow logs and point at: extraction, POST to Beacon, OPA evaluating, verdict signed, write-back commit | "Behind that check, Beacon is doing the work the app team shouldn't have to. Watch." | Platform |
| 6 | 3:30–4:30 | Scroll up to the bot comment | "Approved. Decision ID. Signed under policy bundle v2026.05.03. Five controls — one primary at the mesh, four transitive. Expires in 30 days. All derived by Beacon. The team didn't write it." | Network Security + App DX |
| 7 | 4:30–5:00 | New commit that appeared during the check; click in; show `.beacon/approvals/orders-to-payments.yaml` | "The approval lives in the team's repo now. Signed, durable, grep-able. Five months from now, the answer to 'was this approved' is in git, not a system call." | App DX + audit |
| 8 | 5:00–6:30 | Deny PR. Point at `ttlDays: 120`. Check goes red. Read the comment aloud | "Same team, longer TTL. TTL exceeds max — restricted destination, 30-day cap. Here's how to fix it." | All |
| 9 | 6:30–7:00 | Failing check; signed deny verdict in workflow artifacts | "The deny is also signed. Not 'somebody's check failed.' A signed enterprise decision exists, with the rule ID, the policy bundle version, the evidence. Replayable for audit." | Network Security |
| 10 | 7:00–7:30 | Slide: side-by-side of the 5 artifact JSONs | "Everything you just saw is backed by these five real artifacts, captured from that run. No mockups." | All |
| 11 | 7:30–9:30 | Slide: 'What's real. What's stubbed.' | **Real:** extraction, OPA evaluation, signed verdict, signed bundle, implementation-hash binding, write-back, fail-closed extraction.  **Stubbed:** enrichment, destination resolution, single Helm extractor, single OPA bundle, local signing key, no assurance loop. | All |
| 12 | 9:30–10:30 | Slide: production architecture with the Kubernetes-hosted Beacon application, enrichment connectors, assurance loop, policy bundle pipeline | "The demo's `beacon-app` sidecar is the spine of this. Same API. Same contracts. Same internal modules. What we're adding is the integrations and the assurance reconciler." | All |
| 13 | 10:30–12:00 | Slide: **The ask** | (1) Working group: named members from network-security, platform, app DX. (2) Funding decision target date. (3) Access clearances: ServiceNow read, Prisma read, DNS view, K8s read across clusters, sample policy bundle authoring rights for destination owners. (4) Pilot team commitment: one app team, one destination, stated date. | All |

### 6.3 Backup plan

If the live demo fails mid-pitch:

1. Switch to a recorded video of the same flow at slide 3. Clearly say "I'm cutting to the recording so we keep our time." Do not debug live.
2. Recordings live on the laptop with no network dependency. Approximately 30 seconds each, narrated.
3. Re-acquire live demo at slide 11 if Wi-Fi was the issue; that slide is local.

### 6.4 Rhetorical traps to avoid

1. "Beacon will replace Palo Alto." Beacon carries less app-specific change on Palo. Transit firewalls stay.
2. "Network firewall tickets go away." They reduce on transit devices for app-specific intent. They do not go away. Do not overpromise.
3. "OPA is the policy engine." OPA is behind the Beacon PDP boundary. App teams interact with Beacon. Do not put OPA in the audience's mental load.

### 6.5 Three commitments to invite during Q&A

To make the pitch land with each constituency, invite each one to commit to something specific. The win condition is exiting the meeting with three named owners.

- Ask Network Security leadership: "What's the deny rule you most want in the bundle on day one?"
- Ask the platform team: "Where does this Action's reliability target need to be before you'll let it block PRs?"
- Ask the App DX representative: "What's the exception process you'd want when a team disagrees with a deny?"

## 7. Decisions Log

| Decision | Resolution |
| --- | --- |
| Audience for the pitch | A cross-functional steering group: network security, platform, application DX, plus leaders from each domain |
| Pitch goal | Charter alignment, not pilot commitment or funding ask in isolation |
| Format | Live demo of the thinnest end-to-end loop + high-fidelity static artifacts captured from real runs |
| Time to build | Approximately 2 weeks part-time |
| POC slice | Vertical: PR-check-forward, single Helm values shape, signed allow and signed deny, durable write-back |
| Beacon API hosting in the demo | GitHub Actions `services:` sidecar; no external infrastructure |
| Repository topology | Four repos (`beacon-app`, `beacon-policy`, `beacon-action`, `retail-orders`) |
| Beacon app language | Python + FastAPI |
| OPA invocation | Subprocess `opa eval` over baked bundle |
| Demo destination | `payments-api.prod.company.internal` — matches the existing docs |
| Container registry | GitHub Container Registry (`ghcr.io`) |
| Spec location | `docs/build-specification/2026-05-11-beacon-mvp-design.md` |
| Write-back commit author | `github-actions[bot]` via `GITHUB_TOKEN` |
| Branch protection on demo repo | On — deny PR visibly cannot merge |
| Live extraction-failure PR | Include if Phase 4 finishes on time; otherwise screenshot |
| Multi-intent in single PR | Supported in code, not exercised in the demo |
| Verdict response shape | Full envelope including `canonicalRequest` and `enrichmentSnapshot` |

## 8. Glossary

| Term | Meaning |
| --- | --- |
| Beacon | The Enterprise Connectivity Control Plane described in this docs site |
| Beacon app | The Kubernetes-hosted Beacon application in production; the FastAPI sidecar service in the POC |
| Beacon action | The composite GitHub Action invoked by application repositories |
| Beacon API | The HTTP interface exposed by the Beacon app; `POST /v1/verdict` is the only endpoint used in the POC |
| `NetworkIntent` | The canonical intent shape defined in `docs/architecture/intent-model.md` |
| Derived intent | A `NetworkIntent` produced by the Action from implementation config |
| Canonical request | The fully enriched `NetworkIntent` Beacon assembles and OPA evaluates |
| Enrichment snapshot | The joined source + destination metadata referenced by `metadataSnapshotHash` |
| Implementation hash | `sha256` over the canonical bytes of all implementation files the extractor consumed |
| Verdict | The signed allow/deny decision returned by the Beacon API |
| Policy bundle | A signed OPA bundle (Rego + data) produced by `beacon-policy` |
| Write-back | The approved-NetworkIntent YAML committed by the Action to the developer repo on allow |
| `beacon-evidence` | The workflow artifact bundle containing all five JSON files for one decision |

## Appendix A. Example PR Comments

### A.1 Allow

```markdown
### Beacon Connectivity Verdict — Allow

**Decision** `dec-018f7d2f` · signed under `beacon-policy:v2026.05.03`
**Source** `orders-api` in `orders` (eks-prod-use1-retail-a, team-orders, non-pci)
**Destination** `payments-api.prod.company.internal` → `app-payments-api` (team-payments, restricted, PCI)
**TTL** 30 days · expires `2026-06-02`
**Implementation hash** `sha256:31a8...` over `charts/orders/values.yaml`

#### Controls

| Type | Owner | Target |
| --- | --- | --- |
| **istio-service-entry** (primary) | platform-mesh | eks-prod-use1-retail-a/orders |
| equinix-pa | network-security | hybrid-egress |
| onprem-fabric-pa | network-security | pci-datacenter-edge |
| illumio | segmentation | payments-workload-policy |
| destination-owner-approval | team-payments | app-payments-api |

#### Matched rules

- `TTL_RESTRICTED_DESTINATION_MAX_30D`
- `PCI_DESTINATION_REQUIRES_INSPECTION`
- `RESTRICTED_DESTINATION_REQUIRES_OWNER_POLICY`

Evidence artifacts: derived-intent · enrichment-snapshot · canonical-request · signed verdict. See workflow artifacts.
```

### A.2 Deny

```markdown
### Beacon Connectivity Verdict — Deny

**Decision** `dec-018f7d31` · signed under `beacon-policy:v2026.05.03`
**Destination** `payments-api.prod.company.internal` → `app-payments-api` (restricted, PCI)

#### Why this was denied

**`TTL_EXCEEDS_MAX`** — Requested TTL of 120 days exceeds the maximum 30 days allowed for restricted destinations.

#### How to fix

- Reduce `egress.allow[0].ttlDays` to 30 or fewer in `charts/orders/values.yaml`, **or**
- Open an exception request with `team-payments` referencing decision `dec-018f7d31`.

Implementation: `charts/orders/values.yaml`. Hash `sha256:c4b1...`.
```

### A.3 System Error

```markdown
### Beacon Connectivity Verdict — System Error

Beacon PDP unreachable at `http://localhost:8181`. No allow can be issued
without a valid signed verdict. This check fails closed.

Workflow run: 982901774
```

## Appendix B. Demo Workflow YAML

```yaml
# retail-orders/.github/workflows/beacon.yml
name: Beacon Connectivity

on:
  pull_request:
    paths:
      - "charts/**"
      - "terraform/**"
      - "k8s/**"

permissions:
  contents: write          # required for write-back commit
  pull-requests: write

jobs:
  verdict:
    runs-on: ubuntu-latest
    services:
      beacon-app:
        image: ghcr.io/<owner>/beacon-app:demo
        ports: ["8181:8181"]
        env:
          BUNDLE_REVISION: "v2026.05.03"
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: <owner>/beacon-action@v1
        with:
          beacon-url: http://localhost:8181
          implementation-paths: charts,terraform,k8s
```

## Appendix C. Approved NetworkIntent Write-Back YAML

The artifact written to `retail-orders/.beacon/approvals/orders-to-payments.yaml` by the Action when a verdict is allow. Shape comes from `docs/architecture/control-plane-records.md`. Excludes runtime state, full enrichment detail, deployment state, and audit history — those live only in Beacon.

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
    policyBundle: beacon-policy:v2026.05.03
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
