import React from 'react';
import { Arrow, Card, Diagram, palette } from './shared';

export default function ExecutiveFlowDiagram() {
  return (
    <Diagram
      id="executive-flow"
      title="Beacon End-to-End Flow"
      subtitle="Developers declare FQDN-first intent; Beacon resolves, enriches, verdicts, deploys, and continuously proves the result."
      viewBox="0 0 1280 610"
    >
      {(markerId) => (
        <>
          <Card
            x={35}
            y={125}
            w={176}
            h={138}
            title="Developer Intent"
            body={'Team declares the known\nfacts: source workload,\nFQDN, port, protocol,\npurpose, TTL, data class.'}
            fill={palette.tealSoft}
            stroke={palette.teal}
            badge="1"
          />
          <Card
            x={245}
            y={125}
            w={176}
            h={138}
            title="CI Validation"
            body={'GitHub Actions checks\nschema, repo ownership,\nsource identity, required\nfields, and TTL bounds.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
            badge="2"
          />
          <Card
            x={455}
            y={125}
            w={188}
            h={138}
            title="FQDN Resolution"
            body={'Resolver maps hostnames\nto service identity, VIPs,\ncloud resources, zones,\nand confidence warnings.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
            badge="3"
          />
          <Card
            x={677}
            y={125}
            w={194}
            h={138}
            title="Metadata Join"
            body={'Enrichment combines\ncatalog, ServiceNow,\nPrisma, DNS/IPAM, IAM,\ncloud, and compliance.'}
            badge="4"
          />
          <Card
            x={905}
            y={125}
            w={174}
            h={138}
            title="OPA PDP"
            body={'OPA evaluates enterprise\npolicy, owner rules, risk,\nexceptions, and produces\na signed decision record.'}
            fill={palette.greenSoft}
            stroke={palette.green}
            badge="5"
          />
          <Card x={1110} y={83} w={138} h={96} title="Deny" body={'PR check fails with\npolicy IDs, owner,\nand remediation hints.'} fill={palette.redSoft} stroke={palette.red} />
          <Card x={1110} y={224} w={138} h={96} title="Allow" body={'Compiler receives a\nverdict ID, expiry,\nand metadata snapshot.'} fill={palette.greenSoft} stroke={palette.green} />
          <Card
            x={282}
            y={408}
            w={196}
            h={120}
            title="Delivery Rails"
            body={'GitOps handles mesh\nand Kubernetes artifacts;\nTFE handles provider and\ncloud-managed controls.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
          />
          <Card
            x={542}
            y={408}
            w={196}
            h={120}
            title="Primary Controls"
            body={'Specific policy lands at\nServiceEntry, endpoint\npolicy, SG, GCP policy,\nPSC, or Illumio.'}
          />
          <Card
            x={802}
            y={408}
            w={196}
            h={120}
            title="Assurance"
            body={'Collectors compare declared,\napproved, generated,\ndeployed, and observed\nstate for drift.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
          />
          <Arrow x1={211} y1={194} x2={245} y2={194} markerId={markerId} />
          <Arrow x1={421} y1={194} x2={455} y2={194} markerId={markerId} />
          <Arrow x1={643} y1={194} x2={677} y2={194} markerId={markerId} />
          <Arrow x1={871} y1={194} x2={905} y2={194} markerId={markerId} />
          <Arrow x1={1079} y1={168} x2={1110} y2={131} label="deny" color={palette.red} markerId={markerId} />
          <Arrow x1={1079} y1={219} x2={1110} y2={272} label="allow" color={palette.green} markerId={markerId} />
          <Arrow x1={1179} y1={320} x2={380} y2={408} color={palette.green} markerId={markerId} />
          <Arrow x1={478} y1={468} x2={542} y2={468} markerId={markerId} />
          <Arrow x1={738} y1={468} x2={802} y2={468} markerId={markerId} />
        </>
      )}
    </Diagram>
  );
}
