// @ts-check

const siteUrl = process.env.SITE_URL || 'https://example.github.io';
const baseUrl = process.env.BASE_URL || '/';
const organizationName = process.env.GITHUB_ORG || 'example';
const projectName = process.env.GITHUB_REPO || 'beacon-docs';
const githubUrl = process.env.GITHUB_URL || 'https://github.com/';

const config = {
  title: 'Beacon',
  tagline: 'Enterprise Connectivity Control Plane',
  favicon: 'img/favicon.svg',

  url: siteUrl,
  baseUrl,

  organizationName,
  projectName,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: 'docs',
          editUrl: undefined,
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themeConfig: {
    image: 'img/social-card.svg',
    navbar: {
      title: 'Beacon',
      logo: {
        alt: 'Beacon',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'architectureSidebar',
          position: 'left',
          label: 'Architecture',
        },
        {
          href: githubUrl,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Architecture',
          items: [
            {
              label: 'Overview',
              to: '/docs/overview/executive-model',
            },
            {
              label: 'Target Architecture',
              to: '/docs/architecture/end-to-end-architecture',
            },
            {
              label: 'Intent Model',
              to: '/docs/architecture/intent-model',
            },
            {
              label: 'Source Anchors',
              to: '/docs/reference/source-anchors',
            },
          ],
        },
        {
          title: 'Controls',
          items: [
            {
              label: 'PEP Roles',
              to: '/docs/architecture/control-placement',
            },
            {
              label: 'Policy Verdicting',
              to: '/docs/policy/verdicting',
            },
            {
              label: 'Assurance',
              to: '/docs/assurance/assurance-model',
            },
          ],
        },
      ],
      copyright: `Copyright (c) ${new Date().getFullYear()} Beacon.`,
    },
    prism: {
      additionalLanguages: ['rego', 'hcl'],
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  },
};

module.exports = config;
