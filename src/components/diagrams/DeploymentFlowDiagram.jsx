import React from 'react';
import { Arrow, Card, Diagram, palette } from './shared';

export default function DeploymentFlowDiagram() {
  return (
    <Diagram
      id="deployment-flow"
      title="Deployment Flow"
      subtitle="A PR-driven path where every deployed control carries verdict evidence and every bypass path gets blocked."
      viewBox="0 0 1240 585"
    >
      {(markerId) => (
        <>
          <Card
            x={38}
            y={130}
            w={164}
            h={126}
            title="Open PR"
            body={'Team declares FQDN,\nsource workload, port,\nprotocol, purpose, TTL,\nand business context.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
            badge="1"
          />
          <Card
            x={232}
            y={130}
            w={164}
            h={126}
            title="Resolve"
            body={'FQDN is mapped to\nowner, VIP, service,\ncloud resource, zone,\nand confidence score.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
            badge="2"
          />
          <Card
            x={426}
            y={130}
            w={164}
            h={126}
            title="Verdict"
            body={'Beacon PDP evaluates\nenriched input and returns\nallow, deny, exception,\nexpiry, and reasons.'}
            fill={palette.greenSoft}
            stroke={palette.green}
            badge="3"
          />
          <Card x={622} y={86} w={168} h={94} title="Deny Path" body={'PR check fails with\nrule IDs, owner input,\nand remediation text.'} fill={palette.redSoft} stroke={palette.red} />
          <Card x={622} y={224} w={168} h={94} title="Allow Path" body={'Compiler renders artifacts\nwith verdict ID, expiry,\nand metadata snapshot.'} fill={palette.greenSoft} stroke={palette.green} />
          <Card
            x={822}
            y={130}
            w={164}
            h={126}
            title="Apply"
            body={'GitOps applies cluster\nand mesh resources; TFE\napplies cloud controls;\nSentinel checks plans.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
            badge="4"
          />
          <Card
            x={1016}
            y={130}
            w={164}
            h={126}
            title="Assure"
            body={'Runtime collectors compare\nPEP config, route state,\nflow logs, and posture\nto approved intent.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
            badge="5"
          />
          <Card x={400} y={390} w={190} h={120} title="Gatekeeper" body={'Blocks unmanaged\nKubernetes or mesh\nresources that bypass\nBeacon annotations.'} />
          <Card x={680} y={390} w={190} h={120} title="Sentinel" body={'Blocks Terraform plans\nmissing verdict metadata\nor using unapproved\ncontrol modules.'} />
          <Arrow x1={202} y1={193} x2={232} y2={193} markerId={markerId} />
          <Arrow x1={396} y1={193} x2={426} y2={193} markerId={markerId} />
          <Arrow x1={590} y1={169} x2={622} y2={133} label="deny" color={palette.red} markerId={markerId} />
          <Arrow x1={590} y1={214} x2={622} y2={271} label="allow" color={palette.green} markerId={markerId} />
          <Arrow x1={790} y1={271} x2={822} y2={193} markerId={markerId} />
          <Arrow x1={986} y1={193} x2={1016} y2={193} markerId={markerId} />
          <Arrow x1={904} y1={256} x2={775} y2={390} markerId={markerId} />
          <Arrow x1={904} y1={256} x2={495} y2={390} markerId={markerId} />
        </>
      )}
    </Diagram>
  );
}
