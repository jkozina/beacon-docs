---
title: "Policy Verdicting"
sidebar_position: 1
description: "How we make allow/deny decisions."
---

# Policy Verdicting

The central PDP is our **Policy Decision Point**. It evaluates enriched intent and returns a signed verdict. Enforcement still happens at the PEPs.

We use explicit deny with implicit allow. That means a request passes unless it violates a known enterprise rule. The important catch: every allow still gets recorded. If we don't record the allow, assurance can't prove intent later.

## Good Central Deny Rules

> **IMPORTANT:** Add Deny based policy

## Verdict Record

Every verdict needs:

- decision ID
- normalized intent
- enriched metadata snapshot
- destination resolution snapshot
- policy bundle version
- matched rule IDs
- allow/deny result
- exception reference, if any
- artifact plan
- repo, commit, PR, workflow run, TFE run, and ticket metadata
- TTL or expiration

That gives us replayability. When metadata or policy changes, we can ask: would we still allow this today?
