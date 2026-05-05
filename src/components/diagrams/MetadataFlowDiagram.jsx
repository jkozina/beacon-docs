import React from 'react';
import { Arrow, Card, Diagram, palette } from './shared';

export default function MetadataFlowDiagram() {
  return (
    <Diagram
      id="metadata-flow"
      title="Metadata And Existing Tools"
      subtitle="ServiceNow and Prisma are enrichment and assurance inputs; Beacon still keeps a normalized metadata snapshot per verdict."
      viewBox="0 0 1210 600"
    >
      {(markerId) => (
        <>
          <Card
            x={50}
            y={120}
            w={212}
            h={130}
            title="GitHub"
            body={'Repo, PR, commit,\nCODEOWNERS, team context,\nworkflow run, and source\nchange history.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
            label="source evidence"
          />
          <Card
            x={50}
            y={260}
            w={212}
            h={130}
            title="ServiceNow ITAM"
            body={'Partial asset inventory,\nlifecycle state, support\ngroup, business service,\nand cleanup workflow.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
            label="asset hints"
          />
          <Card
            x={50}
            y={400}
            w={212}
            h={130}
            title="Prisma"
            body={'Cloud resource inventory,\npublic exposure posture,\ntags, account/project data,\nand posture findings.'}
            fill={palette.goldSoft}
            stroke={palette.gold}
            label="cloud posture"
          />
          <Card
            x={390}
            y={150}
            w={224}
            h={124}
            title="Destination Resolver"
            body={'Correlates FQDN with DNS,\nIPAM, VIPs, ingress, load\nbalancers, PSC endpoints,\nand cloud inventory.'}
          />
          <Card
            x={390}
            y={345}
            w={224}
            h={124}
            title="Metadata Enrichment"
            body={'Builds policy-ready context:\nowner, tenant, centralId,\nenvironment, data class,\npath, risk, and confidence.'}
          />
          <Card
            x={720}
            y={246}
            w={206}
            h={124}
            title="Policy Input"
            body={'Normalized source and target,\nresolution confidence,\nowner policy, risk posture,\nand control requirements.'}
            fill={palette.greenSoft}
            stroke={palette.green}
          />
          <Card
            x={1010}
            y={158}
            w={164}
            h={104}
            title="Verdict Store"
            body={'Decision ID, policy\nbundle, expiry, reason,\nand metadata snapshot.'}
            fill={palette.blueSoft}
            stroke={palette.blue}
          />
          <Card
            x={1010}
            y={352}
            w={164}
            h={104}
            title="Assurance Graph"
            body={'Relationships, drift\nfindings, stale assets,\nand cleanup tasks.'}
            fill={palette.greenSoft}
            stroke={palette.green}
          />
          <Arrow x1={262} y1={176} x2={390} y2={205} markerId={markerId} />
          <Arrow x1={262} y1={316} x2={390} y2={388} markerId={markerId} />
          <Arrow x1={262} y1={456} x2={390} y2={420} markerId={markerId} />
          <Arrow x1={614} y1={212} x2={720} y2={277} markerId={markerId} />
          <Arrow x1={614} y1={407} x2={720} y2={334} markerId={markerId} />
          <Arrow x1={926} y1={286} x2={1010} y2={210} markerId={markerId} />
          <Arrow x1={926} y1={328} x2={1010} y2={404} markerId={markerId} />
        </>
      )}
    </Diagram>
  );
}
