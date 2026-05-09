import React from 'react';
import { Arrow, Card, Diagram, Lane, palette } from './shared';

export default function ControlPlacementDiagram() {
  return (
    <Diagram
      id="control-placement"
      title="Policy Placement Model"
      subtitle="Specific application policy belongs near the workload or destination; transitive firewalls carry stable corridor policy."
      viewBox="0 0 1200 570"
    >
      {(markerId) => (
        <>
          <Lane x={45} y={102} w={310} h={400} title="Source Boundary" fill="#edf6fb" stroke="#d2e3f3" />
          <Lane x={445} y={102} w={310} h={400} title="Transit Corridors" fill="#fff8e8" stroke="#e8d6aa" />
          <Lane x={845} y={102} w={310} h={400} title="Destination Boundary" fill="#edf8f1" stroke="#d6e9d4" />
          <Card
            x={82}
            y={160}
            w={236}
            h={116}
            title="Source Workload"
            body={'The service initiating traffic,\nfor example orders-api.\nThe developer usually knows\nonly the target FQDN.'}
            fill={palette.tealSoft}
            stroke={palette.teal}
          />
          <Card
            x={82}
            y={338}
            w={236}
            h={116}
            title="Primary Source Control"
            body={'Beacon validates specific\nallow policy here when this\nis the closest enforceable\npoint to the source.'}
            fill={palette.greenSoft}
            stroke={palette.green}
          />
          <Card
            x={482}
            y={160}
            w={236}
            h={116}
            title="Inspection PEPs"
            body={'Palo Alto GWLB, Equinix\nPalo Alto, and data center\nfabric firewalls inspect\nenterprise corridors.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
          />
          <Card
            x={482}
            y={338}
            w={236}
            h={116}
            title="Pre-Paved Corridors"
            body={'These rules define zones,\ninspection requirements,\nand sanctioned paths; they\ndon\'t churn per app PR.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
          />
          <Card
            x={882}
            y={160}
            w={236}
            h={116}
            title="Owner Policy"
            body={'Destination owners define\ndeny lists, required approvals,\nconsumer constraints, and\nregulated access posture.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
          />
          <Card
            x={882}
            y={338}
            w={236}
            h={116}
            title="Destination Control"
            body={'Illumio, endpoint policy,\nsecurity group, PSC, or\nservice-side guardrail can\nprotect the target side.'}
            fill={palette.greenSoft}
            stroke={palette.green}
          />
          <Arrow x1={200} y1={276} x2={200} y2={338} markerId={markerId} />
          <Arrow x1={318} y1={396} x2={482} y2={396} markerId={markerId} />
          <Arrow x1={600} y1={276} x2={600} y2={338} markerId={markerId} />
          <Arrow x1={718} y1={396} x2={882} y2={396} markerId={markerId} />
          <Arrow x1={1000} y1={276} x2={1000} y2={338} markerId={markerId} />
        </>
      )}
    </Diagram>
  );
}
