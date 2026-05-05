import React from 'react';
import { Arrow, Card, Diagram, Lane, palette } from './shared';

export default function ArchitectureFlowDiagram() {
  return (
    <Diagram
      id="architecture-flow"
      title="Control Plane Architecture"
      subtitle="Beacon coordinates GitHub, OPA, TFE, Gatekeeper, ServiceNow, Prisma, and existing enforcement points."
      viewBox="0 0 1260 650"
    >
      {(markerId) => (
        <>
          <Lane x={36} y={100} w={245} h={475} title="Intake" fill="#edf6fb" stroke="#d2e3f3" />
          <Lane x={330} y={100} w={525} h={475} title="Decision System" />
          <Lane x={900} y={100} w={325} h={475} title="Delivery And Runtime" fill="#f1f8f4" stroke="#d6e9d4" />
          <Card
            x={66}
            y={148}
            w={185}
            h={112}
            title="GitHub Enterprise"
            body={'Source of record for\nintent, generated artifacts,\npolicy bundles, reviews,\nand PR evidence.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
          />
          <Card
            x={66}
            y={328}
            w={185}
            h={112}
            title="GitHub Actions"
            body={'Runs schema checks,\nresolver calls, enrichment,\nBeacon verdict calls, and\ncompiler dry-runs on PRs.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
          />
          <Card
            x={365}
            y={137}
            w={205}
            h={118}
            title="Destination Resolver"
            body={'Turns FQDNs into\npolicy-ready identity:\nowner, VIP, ingress,\nzone, and confidence.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
          />
          <Card
            x={365}
            y={328}
            w={205}
            h={118}
            title="Metadata Enrichment"
            body={'Joins catalog, CMDB,\nServiceNow, Prisma,\ncloud inventory, IAM,\nDNS/IPAM, and risk.'}
          />
          <Card
            x={630}
            y={227}
            w={185}
            h={122}
            title="Beacon PDP"
            body={'Managed verdict service:\nallow, deny, exception,\nprimary/transitive controls,\nexpiry, and bundle ID.'}
            fill={palette.greenSoft}
            stroke={palette.green}
          />
          <Card
            x={930}
            y={137}
            w={190}
            h={118}
            title="Artifact Compiler"
            body={'Renders approved intent\ninto PEP-specific config\nwith verdict IDs and\nmetadata annotations.'}
          />
          <Card
            x={930}
            y={320}
            w={190}
            h={118}
            title="Delivery Rails"
            body={'GitOps applies mesh and\ncluster resources; TFE\napplies cloud/provider\ncontrols with Sentinel.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
          />
          <Card
            x={930}
            y={462}
            w={190}
            h={92}
            title="Runtime Collectors"
            body={'Read PEP config, route\nstate, flow logs, mesh,\nPalo Alto, and Illumio.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
          />
          <Card
            x={666}
            y={462}
            w={170}
            h={92}
            title="Assurance Graph"
            body={'Links declarations,\nverdicts, artifacts,\nflows, routes, owners.'}
            fill={palette.greenSoft}
            stroke={palette.green}
          />
          <Arrow x1={251} y1={204} x2={365} y2={196} markerId={markerId} />
          <Arrow x1={251} y1={384} x2={365} y2={387} markerId={markerId} />
          <Arrow x1={570} y1={196} x2={630} y2={261} markerId={markerId} />
          <Arrow x1={570} y1={387} x2={630} y2={314} markerId={markerId} />
          <Arrow x1={815} y1={269} x2={930} y2={196} label="allow" color={palette.green} markerId={markerId} />
          <Arrow x1={1025} y1={255} x2={1025} y2={320} markerId={markerId} />
          <Arrow x1={1025} y1={438} x2={1025} y2={462} markerId={markerId} />
          <Arrow x1={930} y1={508} x2={836} y2={508} markerId={markerId} />
        </>
      )}
    </Diagram>
  );
}
