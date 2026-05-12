---
title: "Beacon MVP — Implementation Plan"
description: "Step-by-step plan to build the Beacon charter-pitch POC defined in the build specification."
sidebar_label: "Beacon MVP Plan"
---

# Beacon MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working end-to-end Beacon POC — a real PR-check loop with signed verdict, durable write-back, and four real artifacts (`beacon-app`, `beacon-policy`, `beacon-action`, `retail-orders`) — to support a 12-minute charter-alignment pitch within ~2 weeks of part-time work.

**Architecture:** Four GitHub repositories. `beacon-app` is a FastAPI service that runs as a GitHub Actions sidecar; it loads a signed OPA policy bundle from `beacon-policy`, resolves and enriches from fixture files, evaluates OPA via subprocess, and signs verdicts with Ed25519. `beacon-action` is a composite Action that extracts a derived `NetworkIntent` from Helm values, computes an implementation hash, calls the sidecar, verifies the verdict signature, posts a PR comment, uploads evidence artifacts, and on allow commits an approved-NetworkIntent YAML back to the PR branch. `retail-orders` is the demo developer repo.

**Tech Stack:** Python 3.11 · FastAPI · Pydantic · OPA 0.66.0 · `cryptography` for Ed25519 · pytest · Docker · GitHub Actions · GitHub Container Registry · `gh` CLI.

**Source spec:** `docs/build-specification/2026-05-11-beacon-mvp-design.md`.

---

## Pre-flight (do once before Phase 1)

| Tool | Verify with | Install if missing |
| --- | --- | --- |
| Python 3.11+ | `python3 --version` | `brew install python@3.11` |
| Docker Desktop | `docker info` | `brew install --cask docker` |
| `opa` 0.66+ | `opa version` | `brew install opa` |
| `gh` CLI authenticated | `gh auth status` | `brew install gh && gh auth login` |
| GitHub Container Registry write | `echo $CR_PAT \| docker login ghcr.io -u <user> --password-stdin` | Generate PAT with `write:packages` scope |
| `openssl` 3+ | `openssl version` | Built into macOS |
| `jq` | `jq --version` | `brew install jq` |

Set these environment variables in your shell profile so every task can use them:

```bash
export BEACON_GH_OWNER="<your-github-username-or-org>"     # e.g. jkozina
export BEACON_WORKSPACE="$HOME/beacon-poc"                  # parent dir for the four repos
mkdir -p "$BEACON_WORKSPACE"
```

All later commands assume `$BEACON_WORKSPACE` exists and `$BEACON_GH_OWNER` is set.

## File map

The four repositories and their final tree (post-build). Tasks below create these files in order.

```text
$BEACON_WORKSPACE/
├── beacon-policy/
│   ├── Makefile
│   ├── keys/
│   │   ├── bundle-signing.pem        # RSA private, gitignored
│   │   └── bundle-signing.pub        # RSA public, committed
│   ├── policy/
│   │   ├── enterprise/
│   │   │   ├── deny.rego
│   │   │   ├── ttl.rego
│   │   │   └── controls.rego
│   │   └── destinations/
│   │       └── payments.rego
│   ├── data/
│   │   ├── compliance-zones.json
│   │   └── approved-destinations.json
│   ├── tests/
│   │   ├── deny_test.rego
│   │   ├── ttl_test.rego
│   │   └── controls_test.rego
│   ├── build/
│   │   ├── bundle.tar.gz             # gitignored; built artifact
│   │   └── bundle.tar.gz.sig         # detached Ed25519 signature
│   └── .gitignore
│
├── beacon-app/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── api/
│   │   ├── __init__.py
│   │   ├── server.py                 # FastAPI app, POST /v1/verdict
│   │   └── models.py                 # Pydantic request/response models
│   ├── orchestrator/
│   │   ├── __init__.py
│   │   └── pipeline.py               # resolve → enrich → evaluate → sign
│   ├── resolver/
│   │   ├── __init__.py
│   │   └── resolver.py
│   ├── enricher/
│   │   ├── __init__.py
│   │   └── enricher.py
│   ├── pdp/
│   │   ├── __init__.py
│   │   └── opa_runner.py
│   ├── signer/
│   │   ├── __init__.py
│   │   └── signer.py
│   ├── keys/
│   │   ├── verdict-signing.pem       # Ed25519 private, gitignored
│   │   ├── verdict-signing.pub       # Ed25519 public, committed
│   │   └── bundle-signing.pub        # copied from beacon-policy
│   ├── fixtures/
│   │   ├── destinations/
│   │   │   ├── payments-api.prod.company.internal.json
│   │   │   └── customers-api.prod.company.internal.json   # Phase 4
│   │   └── sources/
│   │       └── orders.json
│   ├── bundle/
│   │   ├── bundle.tar.gz             # baked from beacon-policy
│   │   └── bundle.tar.gz.sig
│   ├── tests/
│   │   ├── test_resolver.py
│   │   ├── test_enricher.py
│   │   ├── test_opa_runner.py
│   │   ├── test_signer.py
│   │   └── test_server.py
│   ├── .dockerignore
│   └── .gitignore
│
├── beacon-action/
│   ├── action.yml
│   ├── requirements.txt
│   ├── scripts/
│   │   ├── extract.py
│   │   ├── impl_hash.py
│   │   ├── call_pdp.py
│   │   ├── verify_signature.py
│   │   ├── post_comment.py
│   │   └── write_back.py
│   ├── templates/
│   │   ├── allow_comment.md
│   │   ├── deny_comment.md
│   │   ├── system_error_comment.md
│   │   └── approved_networkintent.yaml
│   ├── keys/
│   │   └── beacon-verdict.pub        # copied from beacon-app
│   ├── tests/
│   │   ├── test_extract.py
│   │   ├── test_impl_hash.py
│   │   └── test_verify.py
│   └── README.md
│
└── retail-orders/
    ├── charts/orders/values.yaml
    ├── .github/workflows/beacon.yml
    └── README.md
```

## Cut-lines (drop if schedule slips)

In priority order — drop from the bottom up:

| If behind by | Drop |
| --- | --- |
| ~30 min | Live wildcard-host PR (Phase 4 Task 4.6); use a screenshot in the deck |
| ~1 hr | Second destination fixture (`customers-api`); one destination is enough |
| ~2 hrs | Consumer-side signature verification (Phase 3 Task 3.3); call out as future work |
| ~3 hrs | Deny-by-extraction path entirely (Phase 4 Tasks 4.5–4.6); rely on deny-by-policy |
| ~4 hrs | Approved-NetworkIntent write-back (Phase 3 Task 3.5); show in deck only as a "next" step |

Each cut-line above the next preserves a strictly stronger demo. Do not cut Phase 1 or Phase 2; those are the spine.

---

# Phase 1 — Vertical Smoke (~4 hrs)

Goal: a real OPA-evaluated verdict returned by a FastAPI service running in Docker, end-to-end on your laptop. No GitHub Action yet. No signing yet.

### Task 1.1 — Bootstrap the four repositories

**Files:**
- Create: `$BEACON_WORKSPACE/beacon-policy/.gitignore`
- Create: `$BEACON_WORKSPACE/beacon-app/.gitignore`
- Create: `$BEACON_WORKSPACE/beacon-action/.gitignore`
- Create: `$BEACON_WORKSPACE/retail-orders/.gitignore`

- [ ] **Step 1: Create local directories and initialize git in each**

```bash
cd "$BEACON_WORKSPACE"
for r in beacon-policy beacon-app beacon-action retail-orders; do
  mkdir -p "$r"
  git -C "$r" init -b main
done
```

- [ ] **Step 2: Add .gitignore to each repo**

For `beacon-policy/.gitignore`:
```gitignore
build/
keys/bundle-signing.pem
__pycache__/
*.pyc
.DS_Store
```

For `beacon-app/.gitignore`:
```gitignore
__pycache__/
*.pyc
.pytest_cache/
.venv/
keys/verdict-signing.pem
bundle/bundle.tar.gz
bundle/bundle.tar.gz.sig
.DS_Store
```

For `beacon-action/.gitignore`:
```gitignore
__pycache__/
*.pyc
.pytest_cache/
.venv/
.DS_Store
```

For `retail-orders/.gitignore`:
```gitignore
.beacon/
.DS_Store
```

- [ ] **Step 3: Create empty GitHub repositories**

```bash
cd "$BEACON_WORKSPACE"
for r in beacon-policy beacon-app beacon-action retail-orders; do
  gh repo create "$BEACON_GH_OWNER/$r" --public --source="$r"
done
```

Expected: four `https://github.com/$BEACON_GH_OWNER/<repo>` URLs printed.

- [ ] **Step 4: Verify**

```bash
gh repo list "$BEACON_GH_OWNER" --limit 20 | grep beacon
gh repo list "$BEACON_GH_OWNER" --limit 20 | grep retail-orders
```

Expected: all four listed.

- [ ] **Step 5: Commit initial scaffolding**

```bash
for r in beacon-policy beacon-app beacon-action retail-orders; do
  cd "$BEACON_WORKSPACE/$r"
  git add .gitignore
  git commit -m "chore: initial scaffold"
  git push -u origin main
done
```

---

### Task 1.2 — `beacon-policy`: one Rego rule, one test, signed bundle

**Files:**
- Create: `beacon-policy/policy/enterprise/ttl.rego`
- Create: `beacon-policy/tests/ttl_test.rego`
- Create: `beacon-policy/data/approved-destinations.json`
- Create: `beacon-policy/Makefile`
- Create: `beacon-policy/keys/bundle-signing.pem` (RSA private, gitignored)
- Create: `beacon-policy/keys/bundle-signing.pub` (RSA public, committed)

- [ ] **Step 1: Generate the bundle-signing RSA keypair**

```bash
cd "$BEACON_WORKSPACE/beacon-policy"
mkdir -p keys
openssl genrsa -out keys/bundle-signing.pem 2048
openssl rsa -in keys/bundle-signing.pem -pubout -out keys/bundle-signing.pub
```

Expected: two files in `keys/`. Verify with `ls keys/`.

- [ ] **Step 2: Write the test first (TDD)**

Create `beacon-policy/tests/ttl_test.rego`:

```rego
package beacon.verdict_test

import data.beacon.verdict

test_ttl_exceeds_max_for_restricted_destination {
  result := verdict.deny with input as {
    "spec": {
      "destination": {"dataClassification": "restricted"},
      "lifecycle": {"requestedTtlDays": 120}
    }
  }
  some d in result
  d.id == "TTL_EXCEEDS_MAX"
}

test_ttl_within_max_for_restricted_destination_passes {
  result := verdict.deny with input as {
    "spec": {
      "destination": {"dataClassification": "restricted"},
      "lifecycle": {"requestedTtlDays": 30}
    }
  }
  not has_ttl_deny(result)
}

has_ttl_deny(denies) {
  some d in denies
  d.id == "TTL_EXCEEDS_MAX"
}
```

- [ ] **Step 3: Run the test, confirm it fails (no implementation yet)**

```bash
cd "$BEACON_WORKSPACE/beacon-policy"
mkdir -p policy/enterprise
opa test tests/ policy/ 2>&1 | head -20
```

Expected: errors like `rego_unsafe_var_error: var data.beacon.verdict is not defined`.

- [ ] **Step 4: Write minimal policy**

Create `beacon-policy/policy/enterprise/ttl.rego`:

```rego
package beacon.verdict

import rego.v1

max_ttl_days := 30 if {
  input.spec.destination.dataClassification == "restricted"
} else := 90 if {
  input.spec.source.environment == "prod"
} else := 180

deny contains {
  "id": "TTL_EXCEEDS_MAX",
  "message": sprintf("Requested TTL of %d days exceeds maximum of %d days", [input.spec.lifecycle.requestedTtlDays, max_ttl_days])
} if {
  input.spec.lifecycle.requestedTtlDays > max_ttl_days
}

default allow := false

allow if {
  count(deny) == 0
}
```

- [ ] **Step 5: Add stub data**

Create `beacon-policy/data/approved-destinations.json`:

```json
{
  "destinations": []
}
```

- [ ] **Step 6: Re-run tests; confirm they pass**

```bash
opa test tests/ policy/ data/ -v
```

Expected: `2 tests, 2 passed`.

- [ ] **Step 7: Add Makefile**

Create `beacon-policy/Makefile`:

```makefile
.PHONY: test build clean

test:
	opa test policy/ data/ tests/ -v

build: test
	mkdir -p build
	opa build \
		--signing-key keys/bundle-signing.pem \
		--signing-alg RS256 \
		--bundle policy \
		--bundle data \
		--output build/bundle.tar.gz
	@echo "Bundle built: build/bundle.tar.gz"

clean:
	rm -rf build/
```

- [ ] **Step 8: Build the signed bundle**

```bash
make build
ls -la build/
```

Expected: `build/bundle.tar.gz` exists, size ~5 KB.

- [ ] **Step 9: Verify the bundle is signed**

```bash
mkdir -p /tmp/bundle-inspect
tar -xzf build/bundle.tar.gz -C /tmp/bundle-inspect
ls /tmp/bundle-inspect/
cat /tmp/bundle-inspect/.signatures.json | jq .
```

Expected: `.signatures.json` exists and contains a JWS string in the `signatures[0].keyid` / `signatures[0].signed` form.

- [ ] **Step 10: Commit**

```bash
cd "$BEACON_WORKSPACE/beacon-policy"
git add Makefile policy/ data/ tests/ keys/bundle-signing.pub
git commit -m "feat: ttl deny rule, tests, signed bundle build"
git push
```

---

### Task 1.3 — `beacon-app`: Python project skeleton + Dockerfile

**Files:**
- Create: `beacon-app/requirements.txt`
- Create: `beacon-app/Dockerfile`
- Create: `beacon-app/.dockerignore`
- Create: `beacon-app/api/__init__.py`
- Create: `beacon-app/api/server.py`
- Create: `beacon-app/api/models.py`

- [ ] **Step 1: Pin dependencies**

Create `beacon-app/requirements.txt`:

```text
fastapi==0.110.0
uvicorn[standard]==0.27.1
pydantic==2.6.3
cryptography==42.0.5
pytest==8.0.2
httpx==0.27.0
```

- [ ] **Step 2: Set up a local venv and install**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: install completes; `python -c "import fastapi"` succeeds.

- [ ] **Step 3: Pydantic models**

Create `beacon-app/api/models.py`:

```python
from typing import Any, Optional
from pydantic import BaseModel, Field


class ImplementationContext(BaseModel):
    hash: str
    repository: str
    pullRequest: int
    commit: str
    actor: str
    workflowRunId: str
    implementationFiles: list[str]


class DerivedIntent(BaseModel):
    apiVersion: str
    kind: str
    metadata: dict[str, Any]
    spec: dict[str, Any]


class VerdictRequest(BaseModel):
    derivedIntent: DerivedIntent
    implementationContext: ImplementationContext
    policyMode: str = "enforce"


class Control(BaseModel):
    type: str
    owner: str
    target: str
    reason: Optional[str] = None


class Controls(BaseModel):
    primary: Optional[Control] = None
    transitive: list[Control] = Field(default_factory=list)


class DenyReason(BaseModel):
    id: str
    message: str


class VerdictResponse(BaseModel):
    decisionId: str
    allow: bool
    policyBundle: str
    evaluatedAt: str
    expiresAt: Optional[str] = None
    implementationHash: str
    metadataSnapshotHash: str
    denyReasons: list[DenyReason] = Field(default_factory=list)
    matchedRules: list[str] = Field(default_factory=list)
    controls: Controls = Field(default_factory=Controls)
    canonicalRequest: dict[str, Any]
    enrichmentSnapshot: dict[str, Any]
    signature: str = ""   # filled in Phase 3
```

- [ ] **Step 4: Stub FastAPI server**

Create `beacon-app/api/__init__.py` (empty).

Create `beacon-app/api/server.py`:

```python
from datetime import datetime, timezone
from fastapi import FastAPI

from api.models import VerdictRequest, VerdictResponse, Controls

app = FastAPI(title="beacon-app", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/verdict", response_model=VerdictResponse)
def verdict(req: VerdictRequest) -> VerdictResponse:
    # Phase 1: hardcoded allow. Phase 1 Task 1.5 replaces this with the real pipeline.
    return VerdictResponse(
        decisionId="dec-stub-0001",
        allow=True,
        policyBundle="beacon-policy:stub",
        evaluatedAt=datetime.now(timezone.utc).isoformat(),
        implementationHash=req.implementationContext.hash,
        metadataSnapshotHash="sha256:stub",
        controls=Controls(),
        canonicalRequest={"stub": True},
        enrichmentSnapshot={"stub": True},
    )
```

- [ ] **Step 5: Run the server locally; confirm it responds**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
source .venv/bin/activate
uvicorn api.server:app --host 0.0.0.0 --port 8181 &
sleep 2
curl -s http://localhost:8181/healthz | jq .
kill %1
```

Expected: `{"status":"ok"}`.

- [ ] **Step 6: Dockerfile (Phase 1 version — no bundle yet)**

Create `beacon-app/Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install OPA binary
ARG OPA_VERSION=0.66.0
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -L "https://openpolicyagent.org/downloads/v${OPA_VERSION}/opa_linux_amd64_static" -o /usr/local/bin/opa \
    && chmod +x /usr/local/bin/opa \
    && apt-get purge -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY orchestrator/ ./orchestrator/
COPY resolver/ ./resolver/
COPY enricher/ ./enricher/
COPY pdp/ ./pdp/
COPY signer/ ./signer/
COPY fixtures/ ./fixtures/
COPY keys/ ./keys/
COPY bundle/ ./bundle/

ENV PYTHONPATH=/app
EXPOSE 8181

CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8181"]
```

Create `beacon-app/.dockerignore`:

```text
.venv/
__pycache__/
*.pyc
.pytest_cache/
tests/
```

- [ ] **Step 7: Create empty subpackage directories**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
mkdir -p orchestrator resolver enricher pdp signer fixtures/destinations fixtures/sources keys bundle
touch orchestrator/__init__.py resolver/__init__.py enricher/__init__.py pdp/__init__.py signer/__init__.py
```

- [ ] **Step 8: Build the Docker image; confirm it starts**

```bash
docker build -t beacon-app:dev .
docker run --rm -d --name beacon-app-test -p 8181:8181 beacon-app:dev
sleep 3
curl -s http://localhost:8181/healthz
docker stop beacon-app-test
```

Expected: `{"status":"ok"}`.

- [ ] **Step 9: Commit**

```bash
git add requirements.txt Dockerfile .dockerignore api/ orchestrator/ resolver/ enricher/ pdp/ signer/ fixtures/ keys/ bundle/
git commit -m "feat: beacon-app skeleton with FastAPI stub and Dockerfile"
git push
```

---

### Task 1.4 — `beacon-app`: resolver and enricher with fixtures

**Files:**
- Create: `beacon-app/fixtures/destinations/payments-api.prod.company.internal.json`
- Create: `beacon-app/fixtures/sources/orders.json`
- Create: `beacon-app/resolver/resolver.py`
- Create: `beacon-app/enricher/enricher.py`
- Create: `beacon-app/tests/test_resolver.py`
- Create: `beacon-app/tests/test_enricher.py`

- [ ] **Step 1: Write the destination fixture**

Create `beacon-app/fixtures/destinations/payments-api.prod.company.internal.json`:

```json
{
  "requestedFqdn": "payments-api.prod.company.internal",
  "canonicalFqdn": "payments-api.service.prod.company.internal",
  "type": "service",
  "serviceId": "app-payments-api",
  "appName": "Payments API",
  "ownerTeam": "team-payments",
  "supportGroup": "retail-payments-platform",
  "environment": "prod",
  "tenant": "retail",
  "trustZone": "pci-app",
  "complianceDomain": "pci",
  "dataClassification": "restricted",
  "vip": "10.42.18.25",
  "exposure": "internal",
  "backingPlatform": "openshift",
  "cluster": "ocp-prod-dc1-payments",
  "namespace": "payments",
  "resolution": {
    "status": "resolved",
    "confidence": "high",
    "sources": ["internal-dns", "ipam", "service-catalog", "servicenow-itam", "prisma", "openshift-ingress"],
    "resolvedAddresses": ["10.42.18.25"]
  },
  "serviceNow": {
    "businessService": "Retail Payments",
    "assetRecord": "SN-ASSET-882100",
    "lifecycleState": "active"
  },
  "prisma": {
    "cloudResourceId": null,
    "postureFindings": []
  },
  "ownerPolicy": {
    "requiresSameEnvironment": true,
    "allowedSourceComplianceDomains": ["pci", "non-pci-with-tokenized-data"],
    "blockedSourceZones": ["internet"]
  }
}
```

- [ ] **Step 2: Write the source fixture**

Create `beacon-app/fixtures/sources/orders.json`:

```json
{
  "workloadId": "orders-api",
  "centralId": "app-orders",
  "appName": "Orders API",
  "ownerTeam": "team-orders",
  "supportGroup": "retail-orders-platform",
  "platform": "eks",
  "accountId": "123456789012",
  "region": "us-east-1",
  "cluster": "eks-prod-use1-retail-a",
  "namespace": "orders",
  "serviceAccount": "orders-api",
  "environment": "prod",
  "tenant": "retail",
  "trustZone": "intranet-app",
  "complianceDomain": "non-pci",
  "dataClassification": "confidential",
  "identity": {
    "iamRoleArn": "arn:aws:iam::123456789012:role/orders-api-prod"
  },
  "serviceNow": {
    "businessService": "Retail Ordering",
    "assetRecord": "SN-ASSET-100233",
    "lifecycleState": "active"
  },
  "prisma": {
    "cloudResourceId": "arn:aws:eks:us-east-1:123456789012:cluster/eks-prod-use1-retail-a",
    "postureFindings": []
  }
}
```

- [ ] **Step 3: Resolver test first**

Create `beacon-app/tests/__init__.py` (empty), then `beacon-app/tests/test_resolver.py`:

```python
import pytest
from resolver.resolver import resolve, DestinationNotFound


def test_resolve_payments_returns_canonical_identity():
    dest = resolve("payments-api.prod.company.internal")
    assert dest["serviceId"] == "app-payments-api"
    assert dest["dataClassification"] == "restricted"
    assert dest["resolution"]["confidence"] == "high"


def test_resolve_unknown_fqdn_raises():
    with pytest.raises(DestinationNotFound):
        resolve("nonexistent.example.internal")
```

- [ ] **Step 4: Run the test; expect ImportError**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
source .venv/bin/activate
PYTHONPATH=. pytest tests/test_resolver.py -v
```

Expected: ImportError on `resolver.resolver`.

- [ ] **Step 5: Implement resolver**

Create `beacon-app/resolver/resolver.py`:

```python
import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures" / "destinations"


class DestinationNotFound(Exception):
    pass


def resolve(fqdn: str) -> dict:
    """Resolve an FQDN to a canonical destination identity via fixture lookup."""
    fixture_path = FIXTURES_DIR / f"{fqdn}.json"
    if not fixture_path.exists():
        raise DestinationNotFound(f"No fixture for fqdn={fqdn!r}; tried {fixture_path}")
    with fixture_path.open() as fh:
        return json.load(fh)
```

- [ ] **Step 6: Re-run resolver test; expect pass**

```bash
PYTHONPATH=. pytest tests/test_resolver.py -v
```

Expected: 2 passed.

- [ ] **Step 7: Enricher test**

Create `beacon-app/tests/test_enricher.py`:

```python
from enricher.enricher import enrich


def test_enrich_orders_to_payments_builds_canonical_intent():
    derived = {
        "apiVersion": "network.company.com/v1",
        "kind": "NetworkIntent",
        "metadata": {"name": "orders-to-payments"},
        "spec": {
            "source": {
                "workloadId": "orders-api",
                "namespace": "orders",
                "serviceAccount": "orders-api"
            },
            "destination": {"fqdn": "payments-api.prod.company.internal"},
            "traffic": {"protocol": "TCP", "port": 443, "applicationProtocol": "HTTPS"},
            "purpose": {"businessJustification": "test", "ticket": "CHG1"},
            "lifecycle": {"requestedTtlDays": 30}
        }
    }
    enriched, snapshot, snapshot_hash = enrich(derived)
    assert enriched["spec"]["source"]["centralId"] == "app-orders"
    assert enriched["spec"]["destination"]["serviceId"] == "app-payments-api"
    assert enriched["spec"]["destination"]["resolution"]["confidence"] == "high"
    assert snapshot_hash.startswith("sha256:")
    assert len(snapshot_hash) == 71   # "sha256:" + 64 hex chars
    assert snapshot["source"]["centralId"] == "app-orders"
```

- [ ] **Step 8: Run; expect ImportError**

```bash
PYTHONPATH=. pytest tests/test_enricher.py -v
```

- [ ] **Step 9: Implement enricher**

Create `beacon-app/enricher/enricher.py`:

```python
import hashlib
import json
from pathlib import Path

from resolver.resolver import resolve

SOURCES_DIR = Path(__file__).parent.parent / "fixtures" / "sources"


def _canonical_json(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _load_source_fixture(workload_id: str) -> dict:
    # workload_id -> fixture filename, simple mapping for the POC
    name_map = {"orders-api": "orders.json"}
    path = SOURCES_DIR / name_map.get(workload_id, f"{workload_id}.json")
    if not path.exists():
        raise FileNotFoundError(f"No source fixture for workload_id={workload_id!r}")
    with path.open() as fh:
        return json.load(fh)


def enrich(derived_intent: dict) -> tuple[dict, dict, str]:
    """Returns (enriched_intent, enrichment_snapshot, snapshot_hash)."""
    src = derived_intent["spec"]["source"]
    dst_fqdn = derived_intent["spec"]["destination"]["fqdn"]

    source_meta = _load_source_fixture(src["workloadId"])
    destination_meta = resolve(dst_fqdn)

    # Build the canonical enriched NetworkIntent (intent-model.md shape).
    enriched = {
        "apiVersion": derived_intent["apiVersion"],
        "kind": derived_intent["kind"],
        "metadata": derived_intent["metadata"],
        "spec": {
            "source": {**src, **source_meta},
            "destination": {
                **destination_meta,
                "requestedFqdn": destination_meta["requestedFqdn"],
            },
            "traffic": derived_intent["spec"]["traffic"],
            "purpose": derived_intent["spec"].get("purpose", {}),
            "lifecycle": derived_intent["spec"].get("lifecycle", {}),
            "path": _expected_path(source_meta, destination_meta),
        }
    }

    snapshot = {
        "source": source_meta,
        "destination": destination_meta,
    }
    snapshot_hash = "sha256:" + hashlib.sha256(_canonical_json(snapshot)).hexdigest()

    return enriched, snapshot, snapshot_hash


def _expected_path(source: dict, destination: dict) -> dict:
    """Derive the expected primary + transitive control set."""
    return {
        "preferredPrimaryControl": "istio-service-entry",
        "expectedPrimaryControls": ["istio-service-entry"],
        "requiredTransitiveControls": ["equinix-pa", "onprem-fabric-pa", "illumio"],
        "inspectionRequired": destination.get("complianceDomain") == "pci",
        "expectedRoute": {
            "sourceZone": source.get("trustZone"),
            "destinationZone": destination.get("trustZone"),
        }
    }
```

- [ ] **Step 10: Run all tests**

```bash
PYTHONPATH=. pytest tests/ -v
```

Expected: 4 passed.

- [ ] **Step 11: Commit**

```bash
git add fixtures/ resolver/ enricher/ tests/
git commit -m "feat: resolver and enricher with payments-api and orders fixtures"
git push
```

---

### Task 1.5 — `beacon-app`: OPA runner, signer stub, orchestrator

**Files:**
- Create: `beacon-app/pdp/opa_runner.py`
- Create: `beacon-app/signer/signer.py`
- Create: `beacon-app/orchestrator/pipeline.py`
- Create: `beacon-app/tests/test_opa_runner.py`
- Copy: `beacon-policy/build/bundle.tar.gz` → `beacon-app/bundle/bundle.tar.gz`
- Copy: `beacon-policy/keys/bundle-signing.pub` → `beacon-app/keys/bundle-signing.pub`

- [ ] **Step 1: Copy bundle and bundle-signing public key into `beacon-app`**

```bash
cd "$BEACON_WORKSPACE"
cp beacon-policy/build/bundle.tar.gz       beacon-app/bundle/bundle.tar.gz
cp beacon-policy/keys/bundle-signing.pub   beacon-app/keys/bundle-signing.pub
```

(In Phase 3 we sign and verify the bundle on app startup. For Phase 1 the bundle is just consumed by OPA.)

- [ ] **Step 2: Verify OPA is installed locally**

```bash
opa version
```

Expected: `Version: 0.66.0` (or your pinned version).

- [ ] **Step 3: Write the OPA runner test**

Create `beacon-app/tests/test_opa_runner.py`:

```python
from pdp.opa_runner import evaluate


SAMPLE_INPUT = {
    "spec": {
        "source": {"environment": "prod"},
        "destination": {"dataClassification": "restricted"},
        "lifecycle": {"requestedTtlDays": 120}
    }
}


def test_evaluate_returns_deny_for_long_ttl():
    result = evaluate(SAMPLE_INPUT)
    assert result["allow"] is False
    deny_ids = [d["id"] for d in result["deny"]]
    assert "TTL_EXCEEDS_MAX" in deny_ids


def test_evaluate_returns_allow_for_short_ttl():
    short = dict(SAMPLE_INPUT)
    short["spec"]["lifecycle"]["requestedTtlDays"] = 30
    result = evaluate(short)
    assert result["allow"] is True
```

- [ ] **Step 4: Run the test; expect ImportError**

```bash
PYTHONPATH=. pytest tests/test_opa_runner.py -v
```

- [ ] **Step 5: Implement the OPA runner**

Create `beacon-app/pdp/opa_runner.py`:

```python
import json
import subprocess
from pathlib import Path

BUNDLE_PATH = Path(__file__).parent.parent / "bundle" / "bundle.tar.gz"


class OpaError(RuntimeError):
    pass


def evaluate(canonical_input: dict) -> dict:
    """Invoke `opa eval` against the bundled policy. Returns {allow, deny, controls?, ...}."""
    if not BUNDLE_PATH.exists():
        raise OpaError(f"Bundle missing at {BUNDLE_PATH}")

    cmd = [
        "opa", "eval",
        "--bundle", str(BUNDLE_PATH),
        "--stdin-input",
        "--format", "json",
        "data.beacon.verdict",
    ]
    proc = subprocess.run(
        cmd,
        input=json.dumps(canonical_input).encode("utf-8"),
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise OpaError(f"opa eval failed: {proc.stderr.decode()}")

    raw = json.loads(proc.stdout)
    # opa eval output: {"result": [{"expressions": [{"value": {...}, ...}]}]}
    try:
        value = raw["result"][0]["expressions"][0]["value"]
    except (KeyError, IndexError) as e:
        raise OpaError(f"Unexpected OPA output: {raw}") from e

    return {
        "allow": bool(value.get("allow", False)),
        "deny": list(value.get("deny", [])),
        "matchedRules": _matched_rules(value),
        "controls": value.get("controls", {}),
    }


def _matched_rules(value: dict) -> list[str]:
    # For the POC, the matched rule names are the deny rule IDs that fired,
    # plus any explicit "matchedRules" set the bundle returns (added later).
    return [d.get("id") for d in value.get("deny", []) if d.get("id")]
```

- [ ] **Step 6: Run tests; expect pass**

```bash
PYTHONPATH=. pytest tests/test_opa_runner.py -v
```

Expected: 2 passed.

- [ ] **Step 7: Add a stub signer (Phase 3 will replace)**

Create `beacon-app/signer/signer.py`:

```python
import json


def canonical_json(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign(verdict: dict) -> str:
    """Stub for Phase 1. Phase 3 replaces with real Ed25519 signing."""
    return "beacon-signature:stub:v0"
```

- [ ] **Step 8: Wire the orchestrator**

Create `beacon-app/orchestrator/pipeline.py`:

```python
import uuid
from datetime import datetime, timedelta, timezone

from enricher.enricher import enrich
from pdp.opa_runner import evaluate
from signer.signer import sign

BUNDLE_REVISION = "beacon-policy:v2026.05.03"
DEFAULT_TTL_DAYS = 30


def run_pipeline(derived_intent: dict, implementation_context: dict) -> dict:
    """Resolve, enrich, evaluate, sign. Returns the full verdict envelope."""
    enriched, snapshot, snapshot_hash = enrich(derived_intent)

    opa_result = evaluate(enriched)
    allow = opa_result["allow"]
    deny_reasons = opa_result["deny"]

    requested_ttl = derived_intent["spec"].get("lifecycle", {}).get("requestedTtlDays", DEFAULT_TTL_DAYS)
    evaluated_at = datetime.now(timezone.utc)
    expires_at = evaluated_at + timedelta(days=requested_ttl) if allow else None

    verdict = {
        "decisionId": f"dec-{uuid.uuid4().hex[:8]}",
        "allow": allow,
        "policyBundle": BUNDLE_REVISION,
        "evaluatedAt": evaluated_at.isoformat(),
        "expiresAt": expires_at.isoformat() if expires_at else None,
        "implementationHash": implementation_context["hash"],
        "metadataSnapshotHash": snapshot_hash,
        "denyReasons": deny_reasons,
        "matchedRules": opa_result["matchedRules"],
        "controls": opa_result.get("controls", {}),
        "canonicalRequest": enriched,
        "enrichmentSnapshot": snapshot,
    }
    verdict["signature"] = sign(verdict)
    return verdict
```

- [ ] **Step 9: Replace the stub `/v1/verdict` handler in `api/server.py`**

```python
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException

from api.models import VerdictRequest, VerdictResponse
from orchestrator.pipeline import run_pipeline
from resolver.resolver import DestinationNotFound

app = FastAPI(title="beacon-app", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/verdict", response_model=VerdictResponse)
def verdict(req: VerdictRequest) -> VerdictResponse:
    try:
        envelope = run_pipeline(
            req.derivedIntent.model_dump(),
            req.implementationContext.model_dump(),
        )
    except DestinationNotFound as e:
        raise HTTPException(status_code=400, detail=f"unresolvable_destination: {e}") from e
    return VerdictResponse(**envelope)
```

- [ ] **Step 10: Run server, test happy path**

```bash
PYTHONPATH=. uvicorn api.server:app --port 8181 &
sleep 2

curl -s -X POST http://localhost:8181/v1/verdict \
  -H 'Content-Type: application/json' \
  -d @- <<'JSON' | jq '.allow, .denyReasons, .decisionId'
{
  "derivedIntent": {
    "apiVersion": "network.company.com/v1",
    "kind": "NetworkIntent",
    "metadata": {"name": "orders-to-payments"},
    "spec": {
      "source": {"workloadId": "orders-api", "namespace": "orders", "serviceAccount": "orders-api"},
      "destination": {"fqdn": "payments-api.prod.company.internal"},
      "traffic": {"protocol": "TCP", "port": 443, "applicationProtocol": "HTTPS"},
      "purpose": {"businessJustification": "test", "ticket": "CHG1"},
      "lifecycle": {"requestedTtlDays": 30}
    }
  },
  "implementationContext": {
    "hash": "sha256:stub",
    "repository": "retail/retail-orders",
    "pullRequest": 1,
    "commit": "abc",
    "actor": "tester",
    "workflowRunId": "1",
    "implementationFiles": ["charts/orders/values.yaml"]
  }
}
JSON

kill %1
```

Expected: `true`, `[]`, `"dec-<8 hex>"`.

- [ ] **Step 11: Smoke test the deny path**

Run the same `curl` but with `"requestedTtlDays": 120`. Expected: `false`, deny list contains `TTL_EXCEEDS_MAX`.

- [ ] **Step 12: Run full test suite**

```bash
PYTHONPATH=. pytest tests/ -v
```

Expected: 4 passed.

- [ ] **Step 13: Commit**

```bash
git add bundle/ keys/bundle-signing.pub pdp/ signer/ orchestrator/ api/server.py tests/
git commit -m "feat: opa runner, orchestrator pipeline, real verdict response"
git push
```

---

### Task 1.6 — Phase 1 end-to-end smoke in Docker

**Files:** none new.

- [ ] **Step 1: Rebuild the Docker image with the bundle baked in**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
docker build -t beacon-app:dev .
```

- [ ] **Step 2: Run the container; verify health**

```bash
docker run --rm -d --name beacon-app-test -p 8181:8181 beacon-app:dev
sleep 3
curl -s http://localhost:8181/healthz | jq .
```

Expected: `{"status":"ok"}`.

- [ ] **Step 3: Send the happy-path request**

```bash
curl -s -X POST http://localhost:8181/v1/verdict -H 'Content-Type: application/json' -d @- <<'JSON' | jq '{allow, decisionId, denyReasons}'
{
  "derivedIntent": {
    "apiVersion": "network.company.com/v1",
    "kind": "NetworkIntent",
    "metadata": {"name": "orders-to-payments"},
    "spec": {
      "source": {"workloadId": "orders-api", "namespace": "orders", "serviceAccount": "orders-api"},
      "destination": {"fqdn": "payments-api.prod.company.internal"},
      "traffic": {"protocol": "TCP", "port": 443, "applicationProtocol": "HTTPS"},
      "purpose": {"businessJustification": "test", "ticket": "CHG1"},
      "lifecycle": {"requestedTtlDays": 30}
    }
  },
  "implementationContext": {
    "hash": "sha256:stub",
    "repository": "retail/retail-orders",
    "pullRequest": 1,
    "commit": "abc",
    "actor": "tester",
    "workflowRunId": "1",
    "implementationFiles": ["charts/orders/values.yaml"]
  }
}
JSON
```

Expected: `allow: true`, real `decisionId`, empty `denyReasons`.

- [ ] **Step 4: Send the deny-path request (ttlDays: 120)**

Re-run with `requestedTtlDays: 120`. Expected: `allow: false`, `denyReasons` includes `TTL_EXCEEDS_MAX`.

- [ ] **Step 5: Cleanup**

```bash
docker stop beacon-app-test
```

**Exit criterion for Phase 1:** A `curl` POST to a Dockerized `beacon-app` returns a real OPA-evaluated, structured verdict for both allow and deny inputs.

---

# Phase 2 — GitHub Action Wrapper (~4 hrs)

Goal: open a PR in `retail-orders` and have GitHub Actions execute the full verdict flow end-to-end on a hosted runner.

### Task 2.1 — Push `beacon-app:demo` to GitHub Container Registry

**Files:** none new.

- [ ] **Step 1: Authenticate Docker to GHCR**

```bash
echo "$CR_PAT" | docker login ghcr.io -u "$BEACON_GH_OWNER" --password-stdin
```

If `$CR_PAT` is not set, generate a classic PAT with `write:packages` and `read:packages` scopes at https://github.com/settings/tokens, then `export CR_PAT=<token>`.

- [ ] **Step 2: Tag and push**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
docker tag beacon-app:dev "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
docker push "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
```

- [ ] **Step 3: Make the package public** (so the demo workflow on a fresh PR can pull it)

```bash
gh api -X PATCH "/user/packages/container/beacon-app" -f visibility=public
```

- [ ] **Step 4: Verify**

```bash
gh api "/users/$BEACON_GH_OWNER/packages/container/beacon-app" --jq '.visibility, .html_url'
```

Expected: `"public"` and a URL.

---

### Task 2.2 — `beacon-action`: extractor for Helm `egress.allow`

**Files:**
- Create: `beacon-action/requirements.txt`
- Create: `beacon-action/scripts/extract.py`
- Create: `beacon-action/tests/test_extract.py`

- [ ] **Step 1: Pin dependencies**

Create `beacon-action/requirements.txt`:

```text
pyyaml==6.0.1
requests==2.31.0
cryptography==42.0.5
jinja2==3.1.3
pytest==8.0.2
```

- [ ] **Step 2: Set up venv**

```bash
cd "$BEACON_WORKSPACE/beacon-action"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdir -p scripts tests templates keys
```

- [ ] **Step 3: Extractor test first**

Create `beacon-action/tests/__init__.py` (empty), then `beacon-action/tests/test_extract.py`:

```python
import textwrap
from pathlib import Path
from scripts.extract import extract_from_helm_values, ExtractionError


def test_extract_one_egress_allow(tmp_path: Path):
    f = tmp_path / "values.yaml"
    f.write_text(textwrap.dedent("""
        egress:
          allow:
            - name: payments
              host: payments-api.prod.company.internal
              port: 443
              protocol: HTTPS
              justification: Submit payment authorization requests
              ticket: CHG123456
              ttlDays: 30
    """).strip())
    source_ctx = {"workloadId": "orders-api", "namespace": "orders", "serviceAccount": "orders-api"}
    intents = extract_from_helm_values(f, source_ctx)
    assert len(intents) == 1
    i = intents[0]
    assert i["metadata"]["name"] == "orders-to-payments"
    assert i["spec"]["destination"]["fqdn"] == "payments-api.prod.company.internal"
    assert i["spec"]["traffic"]["port"] == 443
    assert i["spec"]["lifecycle"]["requestedTtlDays"] == 30


def test_extract_wildcard_host_fails(tmp_path: Path):
    f = tmp_path / "values.yaml"
    f.write_text(textwrap.dedent("""
        egress:
          allow:
            - host: "*.legacy.example.com"
              port: 443
    """).strip())
    source_ctx = {"workloadId": "orders-api", "namespace": "orders", "serviceAccount": "orders-api"}
    try:
        extract_from_helm_values(f, source_ctx)
    except ExtractionError as e:
        assert "wildcard" in str(e).lower()
        return
    raise AssertionError("Expected ExtractionError for wildcard host")
```

- [ ] **Step 4: Implement the extractor**

Create `beacon-action/scripts/__init__.py` (empty), then `beacon-action/scripts/extract.py`:

```python
import re
import yaml
from pathlib import Path


class ExtractionError(Exception):
    pass


WILDCARD_RE = re.compile(r"[\*\?]")


def extract_from_helm_values(values_path: Path, source_ctx: dict) -> list[dict]:
    """Walk egress.allow[]; return one derived NetworkIntent per entry. Fail closed on unsupported shapes."""
    data = yaml.safe_load(values_path.read_text()) or {}
    allows = (data.get("egress") or {}).get("allow") or []
    if not allows:
        raise ExtractionError(f"No egress.allow entries found in {values_path}")

    intents = []
    for idx, entry in enumerate(allows):
        host = entry.get("host")
        if not host:
            raise ExtractionError(f"entry {idx}: missing host")
        if WILDCARD_RE.search(host):
            raise ExtractionError(f"entry {idx}: wildcard hosts are not permitted ({host})")
        if "port" not in entry:
            raise ExtractionError(f"entry {idx}: missing port for {host}")
        if not entry.get("justification"):
            raise ExtractionError(f"entry {idx}: missing justification for {host}")

        name = f"{source_ctx['workloadId'].removesuffix('-api')}-to-{entry.get('name') or _name_from_host(host)}"

        intents.append({
            "apiVersion": "network.company.com/v1",
            "kind": "NetworkIntent",
            "metadata": {"name": name},
            "spec": {
                "source": dict(source_ctx),
                "destination": {"fqdn": host},
                "traffic": {
                    "protocol": "TCP",
                    "port": int(entry["port"]),
                    "applicationProtocol": entry.get("protocol", "HTTPS"),
                },
                "purpose": {
                    "businessJustification": entry["justification"],
                    "ticket": entry.get("ticket", ""),
                },
                "lifecycle": {"requestedTtlDays": int(entry.get("ttlDays", 30))},
            },
        })
    return intents


def _name_from_host(host: str) -> str:
    return host.split(".")[0]
```

- [ ] **Step 5: Run tests; expect 2 passed**

```bash
cd "$BEACON_WORKSPACE/beacon-action"
PYTHONPATH=. pytest tests/test_extract.py -v
```

- [ ] **Step 6: Commit**

```bash
git add requirements.txt scripts/__init__.py scripts/extract.py tests/__init__.py tests/test_extract.py
git commit -m "feat: helm values extractor with wildcard-host fail-closed"
git push
```

---

### Task 2.3 — `beacon-action`: implementation hash

**Files:**
- Create: `beacon-action/scripts/impl_hash.py`
- Create: `beacon-action/tests/test_impl_hash.py`

- [ ] **Step 1: Test**

Create `beacon-action/tests/test_impl_hash.py`:

```python
from pathlib import Path
from scripts.impl_hash import compute_impl_hash


def test_impl_hash_is_deterministic(tmp_path: Path):
    a = tmp_path / "a.yaml"; a.write_text("hello\n")
    b = tmp_path / "b.yaml"; b.write_text("world\n")
    h1 = compute_impl_hash([a, b])
    h2 = compute_impl_hash([b, a])     # order-independent (sort by path)
    assert h1 == h2
    assert h1.startswith("sha256:")
    assert len(h1) == 71


def test_impl_hash_changes_with_content(tmp_path: Path):
    a = tmp_path / "a.yaml"; a.write_text("hello\n")
    h1 = compute_impl_hash([a])
    a.write_text("goodbye\n")
    h2 = compute_impl_hash([a])
    assert h1 != h2
```

- [ ] **Step 2: Implement**

Create `beacon-action/scripts/impl_hash.py`:

```python
import hashlib
from pathlib import Path


def compute_impl_hash(files: list[Path], base: Path | None = None) -> str:
    """Compute a deterministic sha256 over canonical bytes of all implementation files.

    Per the build spec section 2.4:
      1. Sort by repository-relative path.
      2. Normalize line endings to LF.
      3. Hash each file; concatenate `path:hash\n`; hash that.
    """
    base = base or Path.cwd()
    pairs: list[tuple[str, str]] = []
    for f in sorted(files, key=lambda p: str(p)):
        rel = str(f.relative_to(base)) if str(f).startswith(str(base)) else str(f)
        raw = f.read_bytes().replace(b"\r\n", b"\n")
        digest = hashlib.sha256(raw).hexdigest()
        pairs.append((rel, digest))

    aggregate = "".join(f"{p}:{d}\n" for p, d in pairs).encode("utf-8")
    return "sha256:" + hashlib.sha256(aggregate).hexdigest()
```

- [ ] **Step 3: Run; expect 2 passed**

```bash
PYTHONPATH=. pytest tests/test_impl_hash.py -v
```

- [ ] **Step 4: Commit**

```bash
git add scripts/impl_hash.py tests/test_impl_hash.py
git commit -m "feat: deterministic implementation hash"
git push
```

---

### Task 2.4 — `beacon-action`: call the Beacon API

**Files:**
- Create: `beacon-action/scripts/call_pdp.py`

- [ ] **Step 1: Implement**

Create `beacon-action/scripts/call_pdp.py`:

```python
import json
import os
import sys
from pathlib import Path

import requests


def call_pdp(beacon_url: str, derived_intent: dict, implementation_context: dict) -> dict:
    resp = requests.post(
        f"{beacon_url.rstrip('/')}/v1/verdict",
        json={
            "derivedIntent": derived_intent,
            "implementationContext": implementation_context,
            "policyMode": "enforce",
        },
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def main() -> int:
    """CLI: read derived intent JSON from stdin, write verdict to stdout, persist artifacts."""
    beacon_url = os.environ["BEACON_URL"]
    out_dir = Path(os.environ.get("BEACON_OUT_DIR", ".beacon"))
    out_dir.mkdir(parents=True, exist_ok=True)

    payload = json.load(sys.stdin)
    derived = payload["derivedIntent"]
    impl_ctx = payload["implementationContext"]

    verdict = call_pdp(beacon_url, derived, impl_ctx)

    name = derived["metadata"]["name"]
    (out_dir / "derived-intents").mkdir(exist_ok=True)
    (out_dir / "verdicts").mkdir(exist_ok=True)
    (out_dir / "canonical").mkdir(exist_ok=True)
    (out_dir / "enrichment").mkdir(exist_ok=True)
    (out_dir / "extraction").mkdir(exist_ok=True)

    (out_dir / "derived-intents" / f"{name}.json").write_text(json.dumps(derived, indent=2))
    (out_dir / "verdicts" / f"{name}.json").write_text(json.dumps(verdict, indent=2))
    (out_dir / "canonical" / f"{name}.json").write_text(json.dumps(verdict.get("canonicalRequest", {}), indent=2))
    (out_dir / "enrichment" / f"{name}.json").write_text(json.dumps(verdict.get("enrichmentSnapshot", {}), indent=2))
    (out_dir / "extraction" / f"{name}.json").write_text(json.dumps({"status": "ok", "name": name}, indent=2))

    json.dump(verdict, sys.stdout)
    return 0 if verdict.get("allow") else 2  # 2 = signed deny; the action treats this as a failed check


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Manual smoke test against local container**

```bash
cd "$BEACON_WORKSPACE/beacon-action"
source .venv/bin/activate

# Make sure beacon-app is running locally
docker run --rm -d --name beacon-app-smoke -p 8181:8181 "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
sleep 3

PAYLOAD='{
  "derivedIntent": {
    "apiVersion": "network.company.com/v1", "kind": "NetworkIntent",
    "metadata": {"name": "orders-to-payments"},
    "spec": {
      "source": {"workloadId": "orders-api", "namespace": "orders", "serviceAccount": "orders-api"},
      "destination": {"fqdn": "payments-api.prod.company.internal"},
      "traffic": {"protocol": "TCP", "port": 443, "applicationProtocol": "HTTPS"},
      "purpose": {"businessJustification": "test", "ticket": "CHG1"},
      "lifecycle": {"requestedTtlDays": 30}
    }
  },
  "implementationContext": {
    "hash": "sha256:stub", "repository": "x", "pullRequest": 1,
    "commit": "abc", "actor": "me", "workflowRunId": "1", "implementationFiles": []
  }
}'

BEACON_URL=http://localhost:8181 BEACON_OUT_DIR=/tmp/.beacon-smoke \
  PYTHONPATH=. python -m scripts.call_pdp <<< "$PAYLOAD" | jq '.allow'

docker stop beacon-app-smoke
ls /tmp/.beacon-smoke/verdicts/
```

Expected: `true`, file `orders-to-payments.json` exists.

- [ ] **Step 3: Commit**

```bash
git add scripts/call_pdp.py
git commit -m "feat: call_pdp CLI persists verdict + evidence artifacts"
git push
```

---

### Task 2.5 — `beacon-action`: render allow comment

**Files:**
- Create: `beacon-action/templates/allow_comment.md`
- Create: `beacon-action/scripts/post_comment.py`

- [ ] **Step 1: Allow comment template**

Create `beacon-action/templates/allow_comment.md`:

```jinja2
### Beacon Connectivity Verdict — Allow

**Decision** `{{ verdict.decisionId }}` · signed under `{{ verdict.policyBundle }}`
**Source** `{{ source.workloadId }}` in `{{ source.namespace }}` ({{ source.cluster }}, {{ source.ownerTeam }}, {{ source.complianceDomain }})
**Destination** `{{ destination.requestedFqdn }}` → `{{ destination.serviceId }}` ({{ destination.ownerTeam }}, {{ destination.dataClassification }}, {{ destination.complianceDomain }})
**TTL** {{ lifecycle.requestedTtlDays }} days · expires `{{ verdict.expiresAt }}`
**Implementation hash** `{{ verdict.implementationHash }}`

#### Controls

| Type | Owner | Target |
| --- | --- | --- |
| **{{ controls.primary.type }}** (primary) | {{ controls.primary.owner }} | {{ controls.primary.target }}{% for t in controls.transitive %}
| {{ t.type }} | {{ t.owner }} | {{ t.target }}{% endfor %}

#### Matched rules

{% for r in verdict.matchedRules %}- `{{ r }}`
{% endfor %}

Evidence artifacts: derived-intent · enrichment-snapshot · canonical-request · signed verdict. See workflow artifacts.
```

- [ ] **Step 2: Comment script**

Create `beacon-action/scripts/post_comment.py`:

```python
import json
import os
import subprocess
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
env = Environment(loader=FileSystemLoader(TEMPLATES_DIR), trim_blocks=False, lstrip_blocks=False)


def render(verdict: dict) -> str:
    canonical = verdict["canonicalRequest"]["spec"]
    if verdict["allow"]:
        tmpl = env.get_template("allow_comment.md")
    else:
        tmpl = env.get_template("deny_comment.md")
    return tmpl.render(
        verdict=verdict,
        source=canonical["source"],
        destination=canonical["destination"],
        lifecycle=canonical["lifecycle"],
        controls=verdict.get("controls", {}),
        denyReasons=verdict.get("denyReasons", []),
    )


def post(pr_number: int, body: str) -> None:
    """Edit existing Beacon comment if found, else create new."""
    marker = "<!-- beacon-verdict-comment -->"
    body_with_marker = f"{marker}\n{body}"

    existing = subprocess.run(
        ["gh", "pr", "view", str(pr_number), "--json", "comments", "--jq",
         f'.comments[] | select(.body | startswith("{marker}")) | .id'],
        capture_output=True, text=True, check=False,
    )
    existing_id = existing.stdout.strip()

    if existing_id:
        # gh doesn't directly support editing PR comments; use the API
        subprocess.run(
            ["gh", "api", "-X", "PATCH",
             f"/repos/{os.environ['GITHUB_REPOSITORY']}/issues/comments/{existing_id}",
             "-f", f"body={body_with_marker}"],
            check=True,
        )
    else:
        subprocess.run(
            ["gh", "pr", "comment", str(pr_number), "--body", body_with_marker],
            check=True,
        )


def main() -> int:
    verdict = json.load(sys.stdin)
    body = render(verdict)
    pr_number = int(os.environ["BEACON_PR_NUMBER"])
    post(pr_number, body)
    print(f"Posted comment to PR #{pr_number}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Add a deny stub template so the import succeeds**

Create `beacon-action/templates/deny_comment.md`:

```jinja2
### Beacon Connectivity Verdict — Deny

**Decision** `{{ verdict.decisionId }}` · signed under `{{ verdict.policyBundle }}`

(Phase 4 fills in the full deny template.)
```

- [ ] **Step 4: Commit**

```bash
git add templates/ scripts/post_comment.py
git commit -m "feat: allow comment rendering + edit-or-create logic"
git push
```

---

### Task 2.6 — `beacon-action`: composite action.yml + driver

**Files:**
- Create: `beacon-action/action.yml`
- Create: `beacon-action/scripts/driver.py`

- [ ] **Step 1: Driver that glues extract → call_pdp → post_comment together**

Create `beacon-action/scripts/driver.py`:

```python
import json
import os
import subprocess
import sys
from pathlib import Path

from scripts.extract import extract_from_helm_values, ExtractionError
from scripts.impl_hash import compute_impl_hash
from scripts.call_pdp import call_pdp
from scripts.post_comment import render, post


def changed_implementation_files(impl_paths: list[str]) -> list[Path]:
    base_ref = os.environ.get("GITHUB_BASE_REF", "main")
    subprocess.run(["git", "fetch", "origin", base_ref], check=True)
    out = subprocess.check_output(
        ["git", "diff", "--name-only", f"origin/{base_ref}...HEAD"],
        text=True,
    )
    all_changed = [Path(p) for p in out.splitlines() if p.strip()]
    matched = [p for p in all_changed if any(str(p).startswith(ip.strip()) for ip in impl_paths)]
    # Filter to Helm values for the POC.
    return [p for p in matched if p.name == "values.yaml"]


def write_evidence(out_dir: Path, name: str, derived: dict, verdict: dict) -> None:
    for sub in ("derived-intents", "verdicts", "canonical", "enrichment", "extraction"):
        (out_dir / sub).mkdir(parents=True, exist_ok=True)
    (out_dir / "derived-intents" / f"{name}.json").write_text(json.dumps(derived, indent=2))
    (out_dir / "verdicts" / f"{name}.json").write_text(json.dumps(verdict, indent=2))
    (out_dir / "canonical" / f"{name}.json").write_text(json.dumps(verdict["canonicalRequest"], indent=2))
    (out_dir / "enrichment" / f"{name}.json").write_text(json.dumps(verdict["enrichmentSnapshot"], indent=2))
    (out_dir / "extraction" / f"{name}.json").write_text(json.dumps({"status": "ok", "name": name}, indent=2))


def main() -> int:
    beacon_url = os.environ["BEACON_URL"]
    impl_paths = os.environ["IMPLEMENTATION_PATHS"].split(",")
    pr_number = int(os.environ["BEACON_PR_NUMBER"])
    out_dir = Path(os.environ.get("BEACON_OUT_DIR", ".beacon"))

    files = changed_implementation_files(impl_paths)
    if not files:
        print("No implementation files changed in this PR; nothing to evaluate.", file=sys.stderr)
        return 0

    impl_hash = compute_impl_hash(files)
    source_ctx = {
        # Hard-coded for the POC retail-orders source. Phase 4 can extend.
        "workloadId": "orders-api", "namespace": "orders", "serviceAccount": "orders-api",
    }

    overall_allow = True

    for f in files:
        try:
            intents = extract_from_helm_values(f, source_ctx)
        except ExtractionError as e:
            # Post extraction-failure comment; fail closed.
            body = f"### Beacon Connectivity Verdict — Extraction Failed\n\nFile: `{f}`\nReason: {e}\n\nThis check fails closed."
            post(pr_number, body)
            return 1

        for derived in intents:
            impl_ctx = {
                "hash": impl_hash,
                "repository": os.environ["GITHUB_REPOSITORY"],
                "pullRequest": pr_number,
                "commit": os.environ.get("GITHUB_SHA", ""),
                "actor": os.environ.get("GITHUB_ACTOR", ""),
                "workflowRunId": os.environ.get("GITHUB_RUN_ID", ""),
                "implementationFiles": [str(p) for p in files],
            }
            verdict = call_pdp(beacon_url, derived, impl_ctx)
            write_evidence(out_dir, derived["metadata"]["name"], derived, verdict)
            post(pr_number, render(verdict))
            if not verdict["allow"]:
                overall_allow = False

    return 0 if overall_allow else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Composite action definition**

Create `beacon-action/action.yml`:

```yaml
name: Beacon Connectivity Verdict
description: Extracts intent from implementation config, calls Beacon, posts PR feedback.
inputs:
  beacon-url:
    description: URL of the Beacon API (e.g. http://localhost:8181)
    required: true
  implementation-paths:
    description: Comma-separated path prefixes to scan for implementation files (e.g. "charts,terraform,k8s")
    required: true
runs:
  using: composite
  steps:
    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: "3.11"
    - name: Install action dependencies
      shell: bash
      run: pip install -r "${{ github.action_path }}/requirements.txt"
    - name: Run Beacon verdict
      shell: bash
      env:
        BEACON_URL: ${{ inputs.beacon-url }}
        IMPLEMENTATION_PATHS: ${{ inputs.implementation-paths }}
        BEACON_PR_NUMBER: ${{ github.event.pull_request.number }}
        BEACON_OUT_DIR: .beacon
        GH_TOKEN: ${{ github.token }}
      run: |
        cd "${{ github.workspace }}"
        PYTHONPATH="${{ github.action_path }}" python -m scripts.driver
    - name: Upload Beacon evidence artifact
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: beacon-evidence
        path: ${{ github.workspace }}/.beacon
```

- [ ] **Step 3: Tag a release**

```bash
cd "$BEACON_WORKSPACE/beacon-action"
git add action.yml scripts/driver.py
git commit -m "feat: composite action with extract → call → comment driver"
git push
git tag v1
git push --tags
```

---

### Task 2.7 — `retail-orders`: demo repo with workflow + happy-path PR

**Files:**
- Create: `retail-orders/charts/orders/values.yaml`
- Create: `retail-orders/.github/workflows/beacon.yml`
- Create: `retail-orders/README.md`

- [ ] **Step 1: Baseline values.yaml on main (no egress block yet)**

```bash
cd "$BEACON_WORKSPACE/retail-orders"
mkdir -p charts/orders .github/workflows
```

Create `retail-orders/charts/orders/values.yaml`:

```yaml
replicaCount: 2
image:
  repository: retail/orders-api
  tag: v1.0.0
service:
  type: ClusterIP
  port: 8080
```

- [ ] **Step 2: Workflow file**

Create `retail-orders/.github/workflows/beacon.yml`:

```yaml
name: Beacon Connectivity

on:
  pull_request:
    paths:
      - "charts/**"
      - "terraform/**"
      - "k8s/**"

permissions:
  contents: write
  pull-requests: write

jobs:
  verdict:
    runs-on: ubuntu-latest
    services:
      beacon-app:
        image: ghcr.io/REPLACE_OWNER/beacon-app:demo
        ports: ["8181:8181"]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: ${{ github.head_ref }}     # check out PR branch HEAD (not the merge ref) so write-back can push
      - uses: REPLACE_OWNER/beacon-action@v1
        with:
          beacon-url: http://localhost:8181
          implementation-paths: charts,terraform,k8s
```

Replace `REPLACE_OWNER`:

```bash
sed -i.bak "s/REPLACE_OWNER/$BEACON_GH_OWNER/g" .github/workflows/beacon.yml
rm .github/workflows/beacon.yml.bak
```

- [ ] **Step 3: README**

Create `retail-orders/README.md`:

```markdown
# retail-orders

Demo application repository for the Beacon connectivity verdict POC.
See `docs/build-specification/2026-05-11-beacon-mvp-design.md` for the broader story.
```

- [ ] **Step 4: Initial commit and push**

```bash
git add charts/ .github/ README.md
git commit -m "chore: baseline retail-orders demo repo"
git push -u origin main
```

- [ ] **Step 5: Create the happy-path branch and PR**

```bash
git checkout -b feat/payments-happy-path
```

Edit `charts/orders/values.yaml`, append:

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

```bash
git add charts/orders/values.yaml
git commit -m "feat: orders egress allow to payments-api"
git push -u origin feat/payments-happy-path
gh pr create --base main --head feat/payments-happy-path \
  --title "feat: orders egress allow to payments-api" \
  --body "Connectivity request for payments-api over HTTPS for 30 days."
```

- [ ] **Step 6: Watch the workflow**

```bash
gh run watch
```

Expected outcome: workflow succeeds; PR receives a Beacon allow comment; `beacon-evidence` artifact is attached to the run.

If the workflow fails on `services:` pulling the image, verify:
- `ghcr.io/$BEACON_GH_OWNER/beacon-app:demo` is public (Task 2.1 Step 3)
- The image name in `beacon.yml` matches your owner

- [ ] **Step 7: Visual confirmation**

Open the PR in the browser. Confirm:
- Beacon Connectivity check appears
- It transitions to green
- A bot comment with the allow verdict body appears
- Workflow run → Artifacts → `beacon-evidence` is downloadable

- [ ] **Step 8: Enable branch protection on `main`**

```bash
gh api -X PUT "/repos/$BEACON_GH_OWNER/retail-orders/branches/main/protection" -f required_status_checks.strict=true \
  -f 'required_status_checks.contexts[]=verdict' \
  -f enforce_admins=false \
  -f required_pull_request_reviews.required_approving_review_count=0 \
  -f restrictions=null
```

This ensures the deny PR in Phase 4 visibly cannot merge.

**Exit criterion for Phase 2:** the happy-path PR shows a green Beacon check, a bot comment with allow verdict, and downloadable evidence artifacts.

---

# Phase 3 — Signing, Write-Back, Artifacts (~4 hrs)

Goal: real Ed25519 signatures on verdicts, consumer-side verification in the Action, bundle signature verified at sidecar startup, and an approved-NetworkIntent YAML committed to the PR branch on allow.

### Task 3.1 — `beacon-app`: Ed25519 verdict signing

**Files:**
- Modify: `beacon-app/signer/signer.py`
- Create: `beacon-app/keys/verdict-signing.pem` (gitignored)
- Create: `beacon-app/keys/verdict-signing.pub` (committed)
- Create: `beacon-app/tests/test_signer.py`

- [ ] **Step 1: Generate Ed25519 keypair**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
openssl genpkey -algorithm ED25519 -out keys/verdict-signing.pem
openssl pkey -in keys/verdict-signing.pem -pubout -out keys/verdict-signing.pub
chmod 600 keys/verdict-signing.pem
```

- [ ] **Step 2: Signer test**

Create `beacon-app/tests/test_signer.py`:

```python
from signer.signer import sign, canonical_json, load_private_key, verify


def test_sign_and_verify_round_trip():
    verdict = {"decisionId": "dec-1", "allow": True, "z": 1, "a": 2}
    sig = sign(verdict)
    assert sig.startswith("beacon-signature:v1:")
    assert verify(verdict, sig) is True


def test_verify_rejects_tampered_verdict():
    verdict = {"decisionId": "dec-1", "allow": True}
    sig = sign(verdict)
    tampered = dict(verdict, allow=False)
    assert verify(tampered, sig) is False


def test_canonical_json_is_sorted():
    a = canonical_json({"b": 1, "a": 2})
    b = canonical_json({"a": 2, "b": 1})
    assert a == b
```

- [ ] **Step 3: Implement real signer**

Replace `beacon-app/signer/signer.py`:

```python
import base64
import json
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.exceptions import InvalidSignature

KEYS_DIR = Path(__file__).parent.parent / "keys"
PRIVATE_KEY_PATH = KEYS_DIR / "verdict-signing.pem"
PUBLIC_KEY_PATH = KEYS_DIR / "verdict-signing.pub"


def canonical_json(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def load_private_key() -> Ed25519PrivateKey:
    return serialization.load_pem_private_key(PRIVATE_KEY_PATH.read_bytes(), password=None)  # type: ignore[return-value]


def load_public_key() -> Ed25519PublicKey:
    return serialization.load_pem_public_key(PUBLIC_KEY_PATH.read_bytes())  # type: ignore[return-value]


def sign(verdict: dict) -> str:
    # Exclude the signature field from the signed payload.
    payload = {k: v for k, v in verdict.items() if k != "signature"}
    key = load_private_key()
    sig = key.sign(canonical_json(payload))
    return "beacon-signature:v1:" + base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")


def verify(verdict: dict, signature: str) -> bool:
    if not signature.startswith("beacon-signature:v1:"):
        return False
    raw = signature[len("beacon-signature:v1:"):]
    raw += "=" * (-len(raw) % 4)  # pad b64
    sig_bytes = base64.urlsafe_b64decode(raw)
    payload = {k: v for k, v in verdict.items() if k != "signature"}
    try:
        load_public_key().verify(sig_bytes, canonical_json(payload))
        return True
    except InvalidSignature:
        return False
```

- [ ] **Step 4: Run tests**

```bash
PYTHONPATH=. pytest tests/test_signer.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Rebuild and push the Docker image**

```bash
docker build -t beacon-app:dev .
docker tag beacon-app:dev "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
docker push "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
```

The Dockerfile's `COPY keys/ ./keys/` includes the private key inside the image. **For a production build this would be wrong**; for the demo it's acceptable and visible — note this in the "what's stubbed" slide.

- [ ] **Step 6: Commit**

```bash
git add signer/signer.py keys/verdict-signing.pub tests/test_signer.py
git commit -m "feat: real Ed25519 verdict signing with verify"
git push
```

---

### Task 3.2 — `beacon-app`: verify bundle signature at startup

**Files:**
- Create: `beacon-app/pdp/bundle_verifier.py`
- Modify: `beacon-app/api/server.py` (add startup hook)
- Create: `beacon-app/tests/test_bundle_verifier.py`

- [ ] **Step 1: Test**

Create `beacon-app/tests/test_bundle_verifier.py`:

```python
import shutil
import tarfile
from pathlib import Path

import pytest
from pdp.bundle_verifier import verify_bundle, BundleSignatureError


def test_verify_signed_bundle_passes(tmp_path: Path):
    # Use the real bundle from beacon-policy build output.
    bundle = Path(__file__).parent.parent / "bundle" / "bundle.tar.gz"
    pubkey = Path(__file__).parent.parent / "keys" / "bundle-signing.pub"
    assert verify_bundle(bundle, pubkey) is True


def test_verify_tampered_bundle_fails(tmp_path: Path):
    src = Path(__file__).parent.parent / "bundle" / "bundle.tar.gz"
    pubkey = Path(__file__).parent.parent / "keys" / "bundle-signing.pub"
    tampered = tmp_path / "tampered.tar.gz"
    # Flip one byte in the data portion
    raw = src.read_bytes()
    tampered.write_bytes(raw[:100] + bytes([raw[100] ^ 0xFF]) + raw[101:])
    with pytest.raises(BundleSignatureError):
        verify_bundle(tampered, pubkey)
```

- [ ] **Step 2: Implement**

Create `beacon-app/pdp/bundle_verifier.py`:

```python
import base64
import json
import tarfile
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from cryptography.exceptions import InvalidSignature


class BundleSignatureError(Exception):
    pass


def _b64url_pad(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def verify_bundle(bundle_path: Path, public_key_path: Path) -> bool:
    """Verify OPA bundle's .signatures.json JWS against the RSA public key.

    OPA's bundle signing uses JWS with RS256 by default. Each entry in
    `.signatures.json.signatures[*].signed` is a JWS compact serialization.
    """
    if not bundle_path.exists():
        raise BundleSignatureError(f"Bundle missing: {bundle_path}")

    with tarfile.open(bundle_path, "r:gz") as tf:
        try:
            sig_member = tf.getmember(".signatures.json")
        except KeyError as e:
            raise BundleSignatureError(f"Bundle is not signed (no .signatures.json)") from e
        with tf.extractfile(sig_member) as fh:  # type: ignore[union-attr]
            sigfile = json.load(fh)

    if not sigfile.get("signatures"):
        raise BundleSignatureError("No signatures in bundle")

    pubkey = serialization.load_pem_public_key(public_key_path.read_bytes())
    if not isinstance(pubkey, RSAPublicKey):
        raise BundleSignatureError("Public key is not RSA")

    for entry in sigfile["signatures"]:
        compact = entry["signed"] + "." + entry["signature"] if "signature" in entry else entry["signed"]
        # Compact JWS form: header.payload.signature
        parts = compact.split(".")
        if len(parts) != 3:
            raise BundleSignatureError(f"Malformed JWS: {compact[:40]}...")
        header_b64, payload_b64, signature_b64 = parts
        signed_bytes = (header_b64 + "." + payload_b64).encode("ascii")
        signature = _b64url_pad(signature_b64)
        try:
            pubkey.verify(signature, signed_bytes, PKCS1v15(), hashes.SHA256())
        except InvalidSignature as e:
            raise BundleSignatureError(f"Signature verification failed for {entry.get('keyid')}") from e
    return True
```

> **Note on OPA's signatures.json format:** depending on OPA version, signatures may be stored either as a complete JWS compact string in `signed` or split across `signed` (header+payload) and `signature`. Inspect the output of `tar -xzf build/bundle.tar.gz -C /tmp/insp && jq . /tmp/insp/.signatures.json` to confirm. If the format differs, adjust the JWS reassembly in `verify_bundle` accordingly — the test in Step 1 will catch the mismatch.

- [ ] **Step 3: Inspect actual bundle signature format**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
mkdir -p /tmp/binsp && tar -xzf bundle/bundle.tar.gz -C /tmp/binsp
jq . /tmp/binsp/.signatures.json
```

If the `signed` field looks like a single JWS compact string (`xxx.yyy.zzz`), simplify the verifier to just split on `.` from that single field. Adjust the code in Step 2 accordingly.

- [ ] **Step 4: Run tests; fix until they pass**

```bash
PYTHONPATH=. pytest tests/test_bundle_verifier.py -v
```

- [ ] **Step 5: Wire startup check into the server**

Edit `beacon-app/api/server.py`. Add at the top of the module:

```python
from pathlib import Path
from contextlib import asynccontextmanager
from pdp.bundle_verifier import verify_bundle, BundleSignatureError


@asynccontextmanager
async def lifespan(app):
    bundle = Path(__file__).parent.parent / "bundle" / "bundle.tar.gz"
    pubkey = Path(__file__).parent.parent / "keys" / "bundle-signing.pub"
    try:
        verify_bundle(bundle, pubkey)
        print(f"[beacon-app] bundle verified: {bundle}", flush=True)
    except BundleSignatureError as e:
        print(f"[beacon-app] FATAL: bundle signature verification failed: {e}", flush=True)
        raise SystemExit(2)
    yield
```

And change the FastAPI app constructor:

```python
app = FastAPI(title="beacon-app", version="0.1.0", lifespan=lifespan)
```

- [ ] **Step 6: Rebuild image, smoke test**

```bash
docker build -t beacon-app:dev .
docker run --rm -d --name beacon-app-test -p 8181:8181 beacon-app:dev
sleep 3
curl -s http://localhost:8181/healthz
docker logs beacon-app-test 2>&1 | grep "bundle verified"
docker stop beacon-app-test
```

Expected: container starts, healthz responds, log shows `[beacon-app] bundle verified`.

- [ ] **Step 7: Push image**

```bash
docker tag beacon-app:dev "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
docker push "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
```

- [ ] **Step 8: Commit**

```bash
git add pdp/bundle_verifier.py api/server.py tests/test_bundle_verifier.py
git commit -m "feat: verify policy bundle signature at startup"
git push
```

---

### Task 3.3 — `beacon-action`: consumer-side signature verification

**Files:**
- Create: `beacon-action/scripts/verify_signature.py`
- Create: `beacon-action/keys/beacon-verdict.pub`
- Create: `beacon-action/tests/test_verify.py`
- Modify: `beacon-action/scripts/driver.py` (call verifier before posting)

- [ ] **Step 1: Copy the Beacon verdict public key into the Action**

```bash
cp "$BEACON_WORKSPACE/beacon-app/keys/verdict-signing.pub" \
   "$BEACON_WORKSPACE/beacon-action/keys/beacon-verdict.pub"
```

- [ ] **Step 2: Verifier**

Create `beacon-action/scripts/verify_signature.py`:

```python
import base64
import json
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

KEYS_DIR = Path(__file__).parent.parent / "keys"
PUBLIC_KEY_PATH = KEYS_DIR / "beacon-verdict.pub"


def _canonical_json(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def verify_verdict(verdict: dict) -> bool:
    sig = verdict.get("signature", "")
    if not sig.startswith("beacon-signature:v1:"):
        return False
    raw = sig[len("beacon-signature:v1:"):]
    raw += "=" * (-len(raw) % 4)
    sig_bytes = base64.urlsafe_b64decode(raw)
    payload = {k: v for k, v in verdict.items() if k != "signature"}
    pubkey = serialization.load_pem_public_key(PUBLIC_KEY_PATH.read_bytes())
    try:
        pubkey.verify(sig_bytes, _canonical_json(payload))  # type: ignore[attr-defined]
        return True
    except InvalidSignature:
        return False
```

- [ ] **Step 3: Test**

Create `beacon-action/tests/test_verify.py`:

```python
# Lightweight smoke: a round-trip test would require a private key in the Action repo,
# which we deliberately don't have. Instead, sanity-check the malformed-signature path.
from scripts.verify_signature import verify_verdict


def test_verify_rejects_missing_signature():
    assert verify_verdict({"decisionId": "x"}) is False


def test_verify_rejects_wrong_prefix():
    assert verify_verdict({"decisionId": "x", "signature": "wrong:v1:abc"}) is False
```

A real round-trip integration test happens by running the live workflow against the real `beacon-app` image; if the verify step fails on a legitimate verdict, the workflow turns red.

```bash
cd "$BEACON_WORKSPACE/beacon-action"
PYTHONPATH=. pytest tests/test_verify.py -v
```

Expected: 2 passed.

- [ ] **Step 4: Wire into the driver**

In `beacon-action/scripts/driver.py`, after `verdict = call_pdp(...)`, add:

```python
            from scripts.verify_signature import verify_verdict
            if not verify_verdict(verdict):
                body = (
                    "### Beacon Connectivity Verdict — System Error\n\n"
                    "Verdict signature failed verification. This check fails closed.\n\n"
                    f"Decision ID (unverified): `{verdict.get('decisionId', '?')}`"
                )
                post(pr_number, body)
                return 1
```

- [ ] **Step 5: Re-tag the action**

```bash
cd "$BEACON_WORKSPACE/beacon-action"
git add scripts/verify_signature.py keys/beacon-verdict.pub tests/test_verify.py scripts/driver.py
git commit -m "feat: consumer-side verdict signature verification"
git push
git tag -f v1   # move the tag to the new commit
git push -f --tags
```

- [ ] **Step 6: Re-trigger the happy-path PR**

In the `retail-orders` repo:

```bash
cd "$BEACON_WORKSPACE/retail-orders"
git checkout feat/payments-happy-path
git commit --allow-empty -m "ci: re-trigger verdict with consumer-side verification"
git push
gh run watch
```

Expected: green check, comment posted, no system-error.

---

### Task 3.4 — Artifacts upload (already in action.yml from Task 2.6)

Already done — `actions/upload-artifact@v4` was wired in `action.yml`. Verify after Task 3.3's re-run:

- [ ] **Step 1: Verify artifact appears**

```bash
gh run view --log | head -50
gh run download <run-id>
ls .beacon/
```

Expected: `derived-intents/`, `verdicts/`, `canonical/`, `enrichment/`, `extraction/` all populated.

---

### Task 3.5 — `beacon-action`: write-back of approved NetworkIntent

**Files:**
- Create: `beacon-action/templates/approved_networkintent.yaml`
- Create: `beacon-action/scripts/write_back.py`
- Modify: `beacon-action/scripts/driver.py` (call write_back on allow)

- [ ] **Step 1: Template**

Create `beacon-action/templates/approved_networkintent.yaml`:

```jinja2
apiVersion: network.company.com/v1
kind: NetworkIntent
metadata:
  name: {{ intent_name }}
  namespace: {{ source.namespace }}
  labels:
    network.company.com/central-id: {{ source.centralId }}
    network.company.com/environment: {{ source.environment }}
    network.company.com/tenant: {{ source.tenant }}
  annotations:
    network.company.com/decision-id: {{ verdict.decisionId }}

spec:
  source:
    workloadId: {{ source.workloadId }}
    centralId: {{ source.centralId }}
    namespace: {{ source.namespace }}
    serviceAccount: {{ source.serviceAccount }}
    environment: {{ source.environment }}
    tenant: {{ source.tenant }}

  destination:
    requestedFqdn: {{ destination.requestedFqdn }}
    canonicalFqdn: {{ destination.canonicalFqdn }}
    serviceId: {{ destination.serviceId }}

  traffic:
    direction: egress
    protocol: {{ traffic.protocol }}
    port: {{ traffic.port }}
    applicationProtocol: {{ traffic.applicationProtocol }}
    sni: {{ destination.requestedFqdn }}
    tlsRequired: true

  purpose:
    businessJustification: {{ purpose.businessJustification }}
    ticket: {{ purpose.ticket }}
    requestedBy: {{ actor }}
    dataTypes: []

  lifecycle:
    requestedTtlDays: {{ lifecycle.requestedTtlDays }}
    maxAllowedTtlDays: {{ lifecycle.requestedTtlDays }}
    expiresAt: "{{ verdict.expiresAt }}"

  approval:
    decisionId: {{ verdict.decisionId }}
    allow: true
    policyBundle: {{ verdict.policyBundle }}
    evaluatedAt: "{{ verdict.evaluatedAt }}"
    expiresAt: "{{ verdict.expiresAt }}"
    controls:
      primary:
        type: {{ controls.primary.type }}
        owner: {{ controls.primary.owner }}
        target: {{ controls.primary.target }}
      transitive:{% for t in controls.transitive %}
        - type: {{ t.type }}
          owner: {{ t.owner }}
          target: {{ t.target }}{% endfor %}
    matchedRules:{% for r in verdict.matchedRules %}
      - {{ r }}{% endfor %}
    metadataSnapshotHash: {{ verdict.metadataSnapshotHash }}
    signature: {{ verdict.signature }}
```

- [ ] **Step 2: write_back.py**

Create `beacon-action/scripts/write_back.py`:

```python
import json
import os
import subprocess
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
env = Environment(loader=FileSystemLoader(TEMPLATES_DIR), trim_blocks=False, lstrip_blocks=False)


def render(verdict: dict, actor: str) -> tuple[str, str]:
    canonical = verdict["canonicalRequest"]["spec"]
    intent_name = verdict["canonicalRequest"]["metadata"]["name"]
    tmpl = env.get_template("approved_networkintent.yaml")
    body = tmpl.render(
        intent_name=intent_name,
        verdict=verdict,
        source=canonical["source"],
        destination=canonical["destination"],
        traffic=canonical["traffic"],
        purpose=canonical.get("purpose", {}),
        lifecycle=canonical.get("lifecycle", {}),
        controls=verdict.get("controls", {}),
        actor=actor or "beacon",
    )
    return intent_name, body


def commit_and_push(file_path: Path, decision_id: str) -> None:
    subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
    subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
    subprocess.run(["git", "add", str(file_path)], check=True)
    msg = f"beacon: approval {decision_id} for {file_path.stem}"
    subprocess.run(["git", "commit", "-m", msg], check=True)
    # Push to the PR head ref
    head_ref = os.environ.get("GITHUB_HEAD_REF")
    subprocess.run(["git", "push", "origin", f"HEAD:{head_ref}"], check=True)


def main() -> int:
    verdict = json.load(sys.stdin)
    if not verdict.get("allow"):
        return 0
    intent_name, body = render(verdict, os.environ.get("GITHUB_ACTOR", "beacon"))
    out_path = Path(".beacon/approvals") / f"{intent_name}.yaml"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(body)
    commit_and_push(out_path, verdict["decisionId"])
    print(f"Wrote back: {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Wire into the driver**

In `beacon-action/scripts/driver.py`, after the `post(pr_number, render(verdict))` call:

```python
            if verdict["allow"]:
                # Write back approved NetworkIntent to PR branch.
                from scripts.write_back import render as render_writeback, commit_and_push
                intent_name, body = render_writeback(verdict, os.environ.get("GITHUB_ACTOR", "beacon"))
                out_path = Path(".beacon/approvals") / f"{intent_name}.yaml"
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_text(body)
                commit_and_push(out_path, verdict["decisionId"])
```

Note: `.beacon/approvals/**` is outside the `paths:` filter in `retail-orders/.github/workflows/beacon.yml`, so the push does not re-fire the workflow.

- [ ] **Step 4: Re-tag the action**

```bash
cd "$BEACON_WORKSPACE/beacon-action"
git add templates/approved_networkintent.yaml scripts/write_back.py scripts/driver.py
git commit -m "feat: write approved NetworkIntent back to PR branch on allow"
git push
git tag -f v1
git push -f --tags
```

- [ ] **Step 5: Re-trigger the happy-path PR**

```bash
cd "$BEACON_WORKSPACE/retail-orders"
git checkout feat/payments-happy-path
git commit --allow-empty -m "ci: re-trigger to exercise write-back"
git push
gh run watch
```

Expected:
- Workflow runs and finishes green
- A new commit by `github-actions[bot]` titled `beacon: approval dec-... for orders-to-payments` appears on the PR
- That commit adds `.beacon/approvals/orders-to-payments.yaml`
- The workflow does **not** re-fire from the write-back commit

- [ ] **Step 6: Visually confirm the write-back artifact**

In the GitHub UI, open the new bot commit, view the diff, click into `.beacon/approvals/orders-to-payments.yaml`. Confirm fields populated, signature present.

**Exit criterion for Phase 3:** the same happy-path PR shows (a) a signed verdict in the comment, (b) signature verified consumer-side without error, (c) a new commit on the PR adding the approved-NetworkIntent YAML, (d) `beacon-evidence` artifact intact.

---

# Phase 4 — Deny Path, Breadth, Extraction Failure (~4 hrs)

### Task 4.1 — `beacon-policy`: complete the rule set

**Files:**
- Create: `beacon-policy/policy/enterprise/deny.rego`
- Create: `beacon-policy/policy/enterprise/controls.rego`
- Create: `beacon-policy/policy/destinations/payments.rego`
- Create: `beacon-policy/tests/deny_test.rego`
- Create: `beacon-policy/tests/controls_test.rego`
- Modify: `beacon-policy/data/compliance-zones.json`

- [ ] **Step 1: Add deny.rego (resolution + retired asset + ownership)**

```rego
# policy/enterprise/deny.rego
package beacon.verdict

import rego.v1

deny contains {
  "id": "DESTINATION_UNRESOLVED",
  "message": "Destination FQDN could not be resolved to an owned service"
} if {
  input.spec.destination.resolution.status != "resolved"
}

deny contains {
  "id": "DESTINATION_RETIRED",
  "message": "New connectivity cannot target a retired ServiceNow asset"
} if {
  input.spec.destination.serviceNow.lifecycleState == "retired"
}

deny contains {
  "id": "PUBLIC_TO_RESTRICTED_DENIED",
  "message": "Public-classified workloads cannot access restricted destinations"
} if {
  input.spec.source.dataClassification == "public"
  input.spec.destination.dataClassification == "restricted"
}
```

- [ ] **Step 2: Add controls.rego (primary + transitive + matchedRules)**

```rego
# policy/enterprise/controls.rego
package beacon.verdict

import rego.v1

controls := {
  "primary": primary_control,
  "transitive": transitive_controls,
}

primary_control := {
  "type": "istio-service-entry",
  "owner": "platform-mesh",
  "target": sprintf("%s/%s", [input.spec.source.cluster, input.spec.source.namespace])
}

transitive_controls contains c if {
  input.spec.path.inspectionRequired
  c := {"type": "equinix-pa", "owner": "network-security", "target": "hybrid-egress"}
}

transitive_controls contains c if {
  input.spec.destination.complianceDomain == "pci"
  c := {"type": "onprem-fabric-pa", "owner": "network-security", "target": "pci-datacenter-edge"}
}

transitive_controls contains c if {
  input.spec.destination.dataClassification == "restricted"
  c := {"type": "illumio", "owner": "segmentation", "target": sprintf("%s-workload-policy", [input.spec.destination.serviceId])}
}

transitive_controls contains c if {
  input.spec.destination.dataClassification == "restricted"
  c := {"type": "destination-owner-approval", "owner": input.spec.destination.ownerTeam, "target": input.spec.destination.serviceId}
}

matchedRules contains "TTL_RESTRICTED_DESTINATION_MAX_30D" if {
  input.spec.destination.dataClassification == "restricted"
  input.spec.lifecycle.requestedTtlDays <= 30
}

matchedRules contains "PCI_DESTINATION_REQUIRES_INSPECTION" if {
  input.spec.destination.complianceDomain == "pci"
}

matchedRules contains "RESTRICTED_DESTINATION_REQUIRES_OWNER_POLICY" if {
  input.spec.destination.dataClassification == "restricted"
}
```

- [ ] **Step 3: Add destination owner policy for payments**

```rego
# policy/destinations/payments.rego
package beacon.verdict

import rego.v1

deny contains {
  "id": "PAYMENTS_DEST_BLOCKS_SOURCE_ZONE",
  "message": "Source trust zone is blocked by destination owner policy"
} if {
  input.spec.destination.serviceId == "app-payments-api"
  input.spec.source.trustZone == "internet"
}
```

- [ ] **Step 4: Update controls.rego to expose matchedRules into the verdict**

Modify `policy/enterprise/controls.rego` — already exposes `matchedRules` as a rule. The `opa_runner.py` in `beacon-app` currently reads `value.matchedRules`. Update it to combine OPA-emitted matchedRules with deny-id matched rules.

Edit `beacon-app/pdp/opa_runner.py` — replace `_matched_rules` with:

```python
def _matched_rules(value: dict) -> list[str]:
    """Combine deny IDs and OPA-emitted matchedRules into a deduped list."""
    out = set()
    out.update(d.get("id") for d in value.get("deny", []) if d.get("id"))
    out.update(value.get("matchedRules", []) or [])
    return sorted(out)
```

- [ ] **Step 5: Tests**

`beacon-policy/tests/deny_test.rego`:

```rego
package beacon.verdict_test

import data.beacon.verdict

test_unresolved_destination_denies {
  d := verdict.deny with input as {"spec": {"destination": {"resolution": {"status": "ambiguous"}}, "source": {}, "lifecycle": {"requestedTtlDays": 10}}}
  some r in d
  r.id == "DESTINATION_UNRESOLVED"
}

test_retired_asset_denies {
  d := verdict.deny with input as {
    "spec": {
      "destination": {"resolution": {"status": "resolved"}, "serviceNow": {"lifecycleState": "retired"}},
      "source": {}, "lifecycle": {"requestedTtlDays": 10}
    }
  }
  some r in d
  r.id == "DESTINATION_RETIRED"
}
```

`beacon-policy/tests/controls_test.rego`:

```rego
package beacon.verdict_test

import data.beacon.verdict

input_pci := {
  "spec": {
    "source": {"cluster": "eks-prod", "namespace": "orders"},
    "destination": {"complianceDomain": "pci", "dataClassification": "restricted", "serviceId": "app-x", "ownerTeam": "team-x"},
    "path": {"inspectionRequired": true},
    "lifecycle": {"requestedTtlDays": 30},
  }
}

test_pci_destination_emits_inspection_control {
  c := verdict.controls with input as input_pci
  some t in c.transitive
  t.type == "equinix-pa"
}

test_restricted_destination_emits_owner_approval {
  c := verdict.controls with input as input_pci
  some t in c.transitive
  t.type == "destination-owner-approval"
}
```

- [ ] **Step 6: Run all tests**

```bash
cd "$BEACON_WORKSPACE/beacon-policy"
make test
```

Expected: all tests pass.

- [ ] **Step 7: Rebuild bundle, copy to beacon-app, rebuild image**

```bash
make build
cp build/bundle.tar.gz "$BEACON_WORKSPACE/beacon-app/bundle/bundle.tar.gz"

cd "$BEACON_WORKSPACE/beacon-app"
docker build -t beacon-app:dev .
docker tag beacon-app:dev "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
docker push "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
```

- [ ] **Step 8: Commit beacon-policy**

```bash
cd "$BEACON_WORKSPACE/beacon-policy"
git add policy/ tests/
git commit -m "feat: full deny + controls + matched rules + payments owner policy"
git push
```

- [ ] **Step 9: Commit beacon-app bundle update + opa_runner change**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
git add bundle/bundle.tar.gz pdp/opa_runner.py
git commit -m "chore: refresh bundle with full policy set; merge matchedRules"
git push
```

- [ ] **Step 10: Re-trigger happy-path PR to confirm allow still works**

```bash
cd "$BEACON_WORKSPACE/retail-orders"
git checkout feat/payments-happy-path
git commit --allow-empty -m "ci: re-trigger after policy refresh"
git push
gh run watch
```

Expected: green, allow comment now shows 5 controls (1 primary + 4 transitive) and 3 matched rules.

---

### Task 4.2 — `beacon-action`: deny comment template

**Files:**
- Modify: `beacon-action/templates/deny_comment.md`

- [ ] **Step 1: Full deny template**

Replace `beacon-action/templates/deny_comment.md`:

```jinja2
### Beacon Connectivity Verdict — Deny

**Decision** `{{ verdict.decisionId }}` · signed under `{{ verdict.policyBundle }}`
**Destination** `{{ destination.requestedFqdn }}` → `{{ destination.serviceId }}` ({{ destination.dataClassification }}, {{ destination.complianceDomain }})

#### Why this was denied

{% for d in denyReasons %}**`{{ d.id }}`** — {{ d.message }}

{% endfor %}

#### How to fix

{% if denyReasons | selectattr('id', 'equalto', 'TTL_EXCEEDS_MAX') | list %}- Reduce `egress.allow[0].ttlDays` in `charts/orders/values.yaml` (current request: {{ lifecycle.requestedTtlDays }}, max allowed: 30 for restricted destinations), **or**
- Open an exception with `{{ destination.ownerTeam }}` referencing decision `{{ verdict.decisionId }}`.
{% else %}- See the deny reason(s) above. Consult the destination owner (`{{ destination.ownerTeam }}`) or your platform team.
{% endif %}

Implementation: hash `{{ verdict.implementationHash }}`.
```

- [ ] **Step 2: Smoke test rendering locally**

```bash
cd "$BEACON_WORKSPACE/beacon-action"
source .venv/bin/activate
PYTHONPATH=. python -c "
import json
from scripts.post_comment import render
verdict = {
  'decisionId': 'dec-test', 'allow': False, 'policyBundle': 'bp:v1',
  'evaluatedAt': '2026-05-11T12:00:00Z', 'expiresAt': None,
  'implementationHash': 'sha256:abc', 'metadataSnapshotHash': 'sha256:def',
  'denyReasons': [{'id': 'TTL_EXCEEDS_MAX', 'message': 'Requested 120 days exceeds 30'}],
  'matchedRules': ['TTL_EXCEEDS_MAX'],
  'controls': {},
  'canonicalRequest': {
    'metadata': {'name': 'orders-to-payments'},
    'spec': {
      'source': {'workloadId':'orders-api','namespace':'orders','cluster':'eks','ownerTeam':'team-orders','complianceDomain':'non-pci'},
      'destination': {'requestedFqdn':'payments-api.prod.company.internal','serviceId':'app-payments-api','ownerTeam':'team-payments','dataClassification':'restricted','complianceDomain':'pci'},
      'lifecycle': {'requestedTtlDays': 120},
      'traffic': {'protocol':'TCP','port':443}
    }
  },
  'enrichmentSnapshot': {}, 'signature': 'beacon-signature:v1:xxx'
}
print(render(verdict))
"
```

Expected: a deny comment markdown that looks like Appendix A.2 of the spec.

- [ ] **Step 3: Commit and re-tag**

```bash
git add templates/deny_comment.md
git commit -m "feat: full deny comment template"
git push
git tag -f v1 && git push -f --tags
```

---

### Task 4.3 — `retail-orders`: deny PR

- [ ] **Step 1: Create the deny branch**

```bash
cd "$BEACON_WORKSPACE/retail-orders"
git checkout main && git pull
git checkout -b feat/payments-too-long-ttl
```

Edit `charts/orders/values.yaml`, append:

```yaml

egress:
  allow:
    - name: payments
      host: payments-api.prod.company.internal
      port: 443
      protocol: HTTPS
      justification: Submit payment authorization requests
      ticket: CHG123457
      ttlDays: 120
```

```bash
git add charts/orders/values.yaml
git commit -m "feat: orders egress allow to payments-api, 120 day ttl"
git push -u origin feat/payments-too-long-ttl
gh pr create --base main --head feat/payments-too-long-ttl \
  --title "feat: payments egress with 120 day ttl" \
  --body "Should be denied by Beacon."
gh run watch
```

- [ ] **Step 2: Confirm red check + deny comment + no write-back**

In the PR:
- Beacon Connectivity check is red
- PR comment shows the deny template with `TTL_EXCEEDS_MAX`
- **No** new bot commit on the branch (write-back is allow-only)
- Branch protection blocks the merge button

- [ ] **Step 3: Confirm signed deny artifact**

```bash
gh run download <run-id-of-deny>
cat .beacon/verdicts/orders-to-payments.json | jq '.allow, .signature, .denyReasons'
```

Expected: `false`, signature present, deny reasons populated.

---

### Task 4.4 — Second destination fixture (`customers-api`)

**Files:**
- Create: `beacon-app/fixtures/destinations/customers-api.prod.company.internal.json`
- Modify: `beacon-policy/data/approved-destinations.json` (optional)

- [ ] **Step 1: Customers fixture**

Create `beacon-app/fixtures/destinations/customers-api.prod.company.internal.json`:

```json
{
  "requestedFqdn": "customers-api.prod.company.internal",
  "canonicalFqdn": "customers-api.service.prod.company.internal",
  "type": "service",
  "serviceId": "app-customers-api",
  "appName": "Customers API",
  "ownerTeam": "team-customers",
  "environment": "prod",
  "tenant": "retail",
  "trustZone": "intranet-app",
  "complianceDomain": "non-pci",
  "dataClassification": "confidential",
  "vip": "10.42.20.10",
  "exposure": "internal",
  "backingPlatform": "eks",
  "cluster": "eks-prod-use1-retail-b",
  "namespace": "customers",
  "resolution": {
    "status": "resolved",
    "confidence": "high",
    "sources": ["internal-dns", "ipam", "service-catalog"],
    "resolvedAddresses": ["10.42.20.10"]
  },
  "serviceNow": {"businessService": "Retail Customers", "assetRecord": "SN-ASSET-100299", "lifecycleState": "active"},
  "prisma": {"cloudResourceId": null, "postureFindings": []},
  "ownerPolicy": {"requiresSameEnvironment": false, "allowedSourceComplianceDomains": ["non-pci", "pci"], "blockedSourceZones": ["internet"]}
}
```

- [ ] **Step 2: Rebuild and push image**

```bash
cd "$BEACON_WORKSPACE/beacon-app"
docker build -t beacon-app:dev .
docker tag beacon-app:dev "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"
docker push "ghcr.io/$BEACON_GH_OWNER/beacon-app:demo"

git add fixtures/destinations/customers-api.prod.company.internal.json
git commit -m "feat: customers-api destination fixture"
git push
```

(No PR is required to demo it — the fixture being available is sufficient. The demo deck can mention "Beacon resolves multiple destinations" and show the JSON.)

---

### Task 4.5 — Extraction-failure path verified end-to-end

Already implemented in Task 2.2; this task exercises it on a real PR.

- [ ] **Step 1: Create the wildcard branch**

```bash
cd "$BEACON_WORKSPACE/retail-orders"
git checkout main && git pull
git checkout -b feat/wildcard-host
```

Edit `charts/orders/values.yaml`, append:

```yaml

egress:
  allow:
    - name: legacy
      host: "*.legacy.example.com"
      port: 443
      protocol: HTTPS
      justification: Legacy SaaS access
      ttlDays: 30
```

```bash
git add charts/orders/values.yaml
git commit -m "feat: legacy egress with wildcard host"
git push -u origin feat/wildcard-host
gh pr create --base main --head feat/wildcard-host \
  --title "feat: legacy egress" --body "Will fail extraction."
gh run watch
```

- [ ] **Step 2: Confirm fail-closed extraction comment**

Expected: red check, comment titled `Beacon Connectivity Verdict — Extraction Failed`, no PDP call in workflow logs, no write-back.

**Exit criterion for Phase 4:** Three live PRs work: allow (`feat/payments-happy-path`), deny by policy (`feat/payments-too-long-ttl`), deny by extraction (`feat/wildcard-host`). All three remain open on the demo repo.

---

# Phase 5 — Rehearsal, Capture, Deck Artifacts (~3 hrs)

### Task 5.1 — Full dry run on pitch laptop

- [ ] **Step 1: Reset all three PRs to a clean state**

For each of `feat/payments-happy-path`, `feat/payments-too-long-ttl`, `feat/wildcard-host`:

```bash
gh pr comment <pr-number> --delete    # remove prior bot comments via UI if --delete unavailable
```

Or simply close and re-open each PR to get a fresh check run.

Actually, the cleanest reset is `gh pr close <n>` then `gh pr reopen <n>` — closing a PR doesn't delete its history but re-opening triggers a fresh workflow run, producing fresh bot comments.

- [ ] **Step 2: Run the demo flow exactly as the script (Section 6 of the spec) prescribes**

Sit at the pitch laptop, open the timer app, run through beats 1–13 of the spec's beat sheet. Time yourself.

- [ ] **Step 3: Note timing slip**

If any beat runs long, adjust the cue-card for that beat or trim narration. Re-run.

### Task 5.2 — Record backup videos

- [ ] **Step 1: Record happy-path scenario**

Use macOS QuickTime or Loom to record:
- Opening the happy-path PR
- The check going green
- Reading the bot comment
- Showing the new bot commit and the approval YAML

Save as `~/beacon-demo/recordings/01-happy-path.mp4`. Target ≤90 seconds.

- [ ] **Step 2: Record deny-path scenario**

Same workflow for the deny PR. Save as `02-deny-policy.mp4`.

- [ ] **Step 3: Record extraction-failure scenario**

Same workflow for the wildcard PR. Save as `03-deny-extraction.mp4`.

### Task 5.3 — Capture system-error screenshots

- [ ] **Step 1: PDP unavailable**

Edit `retail-orders/.github/workflows/beacon.yml` on a throwaway branch to remove the `services:` block. Push, watch the workflow fail with connection-refused. Screenshot the bot comment. Save as `~/beacon-demo/screenshots/pdp-unavailable.png`. Revert the branch (do not merge).

- [ ] **Step 2: Bundle tampered**

Locally: tamper a copy of `beacon-app/bundle/bundle.tar.gz` (flip a byte), tag a special image `beacon-app:demo-bad-bundle`, push, edit the workflow to reference that tag on a throwaway branch, watch the container fail to start. Screenshot the container logs from the workflow run. Save as `bundle-tampered.png`. Revert.

### Task 5.4 — Generate deck artifacts

- [ ] **Step 1: Captured Beacon control-plane DB record JSON**

Run a one-off Python script that produces the full control-plane record from `docs/architecture/control-plane-records.md` populated with values from a real verdict. Save as `~/beacon-demo/deck-artifacts/control-plane-record.json`. Embed as a screenshot in the deck.

- [ ] **Step 2: Sample drift finding**

Hand-write a single drift finding using the shape from `docs/assurance/assurance-model.mdx` ("deployed rule with no derived intent" or similar). Save as `~/beacon-demo/deck-artifacts/drift-finding.json`. Embed as a screenshot.

- [ ] **Step 3: 5-artifact panel**

Open all 5 of `derived-intents/`, `canonical/`, `enrichment/`, `verdicts/`, `extraction/` from the happy-path PR's evidence artifact in side-by-side editor windows. Take one screenshot. Save as `5-artifact-panel.png`.

### Task 5.5 — Cue cards

- [ ] **Step 1: One-page cheatsheet**

Print a single page with: beat #, time mark, on-screen note, the *one phrase* you must say at that beat. Format as a table. Carry in your laptop sleeve.

**Exit criterion for Phase 5:** You can demo the full story cold, on the pitch laptop, in under 12 minutes with 5 minutes of slack, and have full recordings + screenshots + deck artifacts as backup.

---

## Final integration check (before pitch day)

- [ ] All three PRs (`feat/payments-happy-path`, `feat/payments-too-long-ttl`, `feat/wildcard-host`) are open on `retail-orders`
- [ ] Branch protection on `retail-orders/main` blocks merging the deny PR
- [ ] `ghcr.io/$BEACON_GH_OWNER/beacon-app:demo` is public and pullable from a fresh machine
- [ ] `$BEACON_GH_OWNER/beacon-action` has the `v1` tag at the latest commit
- [ ] On a freshly-checked-out copy of `retail-orders`, re-running the workflow from the GitHub UI on each PR succeeds for the expected outcome
- [ ] Backup recordings exist for all three scenarios
- [ ] System-error screenshots are captured
- [ ] Deck artifacts (control-plane record, drift finding, 5-artifact panel) are exported

---

## Self-review notes

Cross-check against the spec sections:

| Spec § | Covered by tasks |
| --- | --- |
| 0 | Plan introduction, scope statement |
| 1 | Tasks 1.1, 1.3 (Beacon-app structure), 1.2 (beacon-policy), 2.2/2.6 (beacon-action), 2.7 (retail-orders) |
| 2.1, 2.2 | Tasks 1.3, 1.5 (verdict request/response shape) |
| 2.3 | Task 1.5 (orchestrator pipeline) |
| 2.4 | Task 2.3 (impl hash) |
| 2.5 | Tasks 1.2, 3.2 (bundle + verification) |
| 3.1 | Task 2.7 (workflow YAML) |
| 3.2 | All of Phase 2 + Phase 3 (happy path) |
| 3.3 | Task 4.3 (deny path) |
| 3.4 | Task 2.6 (artifacts upload) |
| 3.5 | Task 3.5 (write-back) |
| 3.6 | Implementation hash already produces multi-intent capable code; demo uses one |
| 4.1 | Phase 4 failure-class implementations |
| 4.2 | Tasks 4.5 (extraction fail), 5.3 (system-error screenshots) |
| 4.3 | Task 3.3 (consumer signature verification) |
| 5 | Phases 1–5 |
| 6 | Task 5.5 (cue cards), implicit in 5.1 |
| 7 | Decisions encoded throughout |
| App. A | Templates in `beacon-action/templates/` |
| App. B | Workflow file in Task 2.7 |
| App. C | Write-back template in Task 3.5 |

No placeholders, no TBDs, no "implement later." Each task contains the code or commands needed to execute it standalone.
