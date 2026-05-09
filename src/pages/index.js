import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

const features = [
  {
    title: 'FQDN-first derived intent',
    text: 'Teams write implementation config while Beacon derives the destination intent and resolves owners, zones, compliance, VIPs, and PEP path.',
  },
  {
    title: 'Primary controls, pre-paved transit',
    text: 'Specific access lands near the source or protected destination. Transitive controls stay broad, stable, and auditable.',
  },
  {
    title: 'Verdicts before deployment',
    text: 'GitHub Actions calls Beacon PDP before GitOps, Terraform Enterprise, Sentinel, and Gatekeeper enforce the path.',
  },
  {
    title: 'Continuous assurance',
    text: 'Source config, derived intent, approved verdicts, deployed state, and observed flows are compared to detect drift and bypass.',
  },
];

export default function Home() {
  return (
    <Layout
      title="Beacon"
      description="Enterprise Connectivity Control Plane">
      <header className={clsx('heroBanner')}>
        <div className="container">
          <Heading as="h1">Beacon</Heading>
          <p>
            Enterprise Connectivity Control Plane for governed workload connectivity across AWS,
            GCP, service mesh, Palo Alto Networks, Illumio, and hybrid data centers.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/docs/overview/executive-model">
              Start Reading
            </Link>
            <Link className="button button--outline button--secondary button--lg" to="/docs/architecture/end-to-end-architecture">
              View Architecture
            </Link>
          </div>
        </div>
      </header>
      <main className="container margin-vert--lg">
        <section className="featureGrid">
          {features.map((feature) => (
            <article className="featureCard" key={feature.title}>
              <Heading as="h3">{feature.title}</Heading>
              <p>{feature.text}</p>
            </article>
          ))}
        </section>
      </main>
    </Layout>
  );
}
