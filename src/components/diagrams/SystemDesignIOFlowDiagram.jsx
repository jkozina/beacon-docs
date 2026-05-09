import React from 'react';
import { Arrow, Card, Diagram, TextLines, palette } from './shared';

export default function SystemDesignIOFlowDiagram() {
  const steps = [
    {
      x: 48,
      title: 'Implementation Config',
      body: 'Developer-owned Helm,\nTerraform, Kubernetes,\nmesh, or platform config.',
      fill: palette.blueSoft,
      stroke: palette.blue,
    },
    {
      x: 273,
      title: 'Strict Extraction',
      body: 'Beacon Action derives\nNetworkIntent and computes\nimplementationHash.',
      fill: palette.goldSoft,
      stroke: palette.gold,
    },
    {
      x: 498,
      title: 'Resolve + Enrich',
      body: 'Add DNS/IPAM,\nServiceNow, Prisma,\nidentity, owner, and risk.',
      fill: palette.card,
      stroke: palette.teal,
    },
    {
      x: 723,
      title: 'PDP Verdict',
      body: 'OPA evaluates canonical\nJSON and returns a signed\nallow or deny decision.',
      fill: palette.greenSoft,
      stroke: palette.green,
    },
    {
      x: 948,
      title: 'PR Evidence',
      body: 'Comment with derived\nintent, verdict, hash,\nTTL, expiry, and findings.',
      fill: palette.greenSoft,
      stroke: palette.green,
    },
    {
      x: 1173,
      title: 'Deploy Same Config',
      body: 'After merge, GitOps,\nHelm, TFE, or platform\npipelines apply it.',
      fill: palette.blueSoft,
      stroke: palette.blue,
    },
    {
      x: 1398,
      title: 'Day-2 Assurance',
      body: 'Compare source config,\nderived intent, verdict,\ndeployed state, and flows.',
      fill: palette.goldSoft,
      stroke: palette.gold,
    },
  ];

  return (
    <Diagram
      id="system-design-io-flow"
      title="Beacon Input/Output Model"
      subtitle="Step by step: implementation config is strictly extracted, enriched, verdicted, hash-bound, deployed, and continuously assured."
      viewBox="0 0 1620 540"
    >
      {(markerId) => (
        <>
          <rect x="28" y="95" width="1564" height="250" rx="14" fill="#edf6fb" stroke="#d2e3f3" />
          <TextLines x={52} y={125} lines="Pull Request to Runtime Workflow" size={13} color={palette.teal} weight={900} />

          {steps.map((step, index) => (
            <Card
              key={step.title}
              x={step.x}
              y={154}
              w={180}
              h={150}
              title={step.title}
              body={step.body}
              fill={step.fill}
              stroke={step.stroke}
              badge={String(index + 1)}
            />
          ))}

          {steps.slice(0, -1).map((step, index) => (
            <Arrow
              key={`${step.title}-arrow`}
              x1={step.x + 180}
              y1={229}
              x2={steps[index + 1].x}
              y2={229}
              markerId={markerId}
            />
          ))}

          <rect x="28" y="372" width="1564" height="112" rx="14" fill="#f5fbf8" stroke="#d9e7e2" />
          <TextLines x={52} y={404} lines="Beacon Records" size={13} color={palette.teal} weight={900} />
          <TextLines
            x={52}
            y={437}
            lines="NetworkIntent derived from implementation config"
            size={12.3}
            color={palette.muted}
            weight={700}
          />
          <TextLines
            x={410}
            y={437}
            lines="enrichment snapshot and metadata hash"
            size={12.3}
            color={palette.muted}
            weight={700}
          />
          <TextLines
            x={740}
            y={437}
            lines="signed PDP verdict bound to implementationHash"
            size={12.3}
            color={palette.muted}
            weight={700}
          />
          <TextLines
            x={1150}
            y={437}
            lines="runtime observations, drift, and assurance findings"
            size={12.3}
            color={palette.muted}
            weight={700}
          />

          <line x1="370" y1="414" x2="370" y2="458" stroke="#d9e7e2" />
          <line x1="700" y1="414" x2="700" y2="458" stroke="#d9e7e2" />
          <line x1="1110" y1="414" x2="1110" y2="458" stroke="#d9e7e2" />
        </>
      )}
    </Diagram>
  );
}
