import React from 'react';
import { Arrow, Card, Diagram, palette } from './shared';

export default function AssuranceModelDiagram() {
  return (
    <Diagram
      id="assurance-model"
      title="Assurance Model"
      subtitle="Beacon continuously compares declared, approved, generated, deployed, and observed state."
      viewBox="0 0 1210 600"
    >
      {(markerId) => (
        <>
          <Card x={45} y={142} w={176} h={112} title="Declared" body={'GitHub intent with\nsource repo, centralId,\nworkload context,\nFQDN, port, and TTL.'} fill={palette.blueSoft} stroke={palette.blue} />
          <Card x={254} y={142} w={176} h={112} title="Approved" body={'Beacon verdict with\npolicy bundle, owner\nrules, risk context,\nand expiration.'} fill={palette.greenSoft} stroke={palette.green} />
          <Card x={463} y={142} w={176} h={112} title="Generated" body={'Compiler output with\nartifact hash, target\nPEP, annotations, and\nrendered diff.'} />
          <Card x={672} y={142} w={176} h={112} title="Deployed" body={'Actual PEP state from\nmesh, SGs, endpoint\npolicy, GCP, Illumio,\nor Palo Alto.'} fill={palette.goldSoft} stroke={palette.gold} />
          <Card x={881} y={142} w={176} h={112} title="Observed" body={'Traffic, logs, routes,\nPrisma posture, flow\nrecords, and service\nmesh telemetry.'} fill={palette.goldSoft} stroke={palette.gold} />
          <Card x={350} y={390} w={240} h={112} title="Assurance Graph" body={'Connects source, target,\nverdict, artifact, PEP,\nroute, owner, asset, and\nobserved flow evidence.'} fill={palette.greenSoft} stroke={palette.green} />
          <Card x={720} y={390} w={240} h={112} title="Findings" body={'Flags missing verdicts,\nroute bypass, expired\naccess, DNS drift, stale\nassets, and broad rules.'} fill={palette.redSoft} stroke={palette.red} />
          <Arrow x1={221} y1={198} x2={254} y2={198} markerId={markerId} />
          <Arrow x1={430} y1={198} x2={463} y2={198} markerId={markerId} />
          <Arrow x1={639} y1={198} x2={672} y2={198} markerId={markerId} />
          <Arrow x1={848} y1={198} x2={881} y2={198} markerId={markerId} />
          <Arrow x1={133} y1={254} x2={350} y2={414} markerId={markerId} />
          <Arrow x1={342} y1={254} x2={414} y2={390} markerId={markerId} />
          <Arrow x1={551} y1={254} x2={470} y2={390} markerId={markerId} />
          <Arrow x1={760} y1={254} x2={535} y2={390} markerId={markerId} />
          <Arrow x1={969} y1={254} x2={590} y2={432} markerId={markerId} />
          <Arrow x1={590} y1={446} x2={720} y2={446} color={palette.red} markerId={markerId} />
        </>
      )}
    </Diagram>
  );
}
