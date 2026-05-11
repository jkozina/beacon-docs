// @ts-check

const architectureSidebar = [
  {
    type: 'category',
    label: 'Overview',
    collapsed: false,
    items: [
      'overview/executive-model',
      'overview/problem-and-principles',
    ],
  },
  {
    type: 'category',
    label: 'Architecture',
    collapsed: false,
    items: [
      'architecture/end-to-end-architecture',
      'architecture/intent-model',
      'architecture/control-plane-records',
      'architecture/control-placement',
    ],
  },
  {
    type: 'category',
    label: 'Metadata',
    collapsed: false,
    items: [
      'metadata/destination-resolution',
      'metadata/metadata-and-tools',
    ],
  },
  {
    type: 'category',
    label: 'Policy',
    collapsed: false,
    items: [
      'policy/verdicting',
      'policy/pdp-service',
      'policy/opa-policy-model',
      'policy/tool-responsibilities',
    ],
  },
  {
    type: 'category',
    label: 'Delivery',
    collapsed: false,
    items: [
      'delivery/deployment-flow',
      'delivery/github-action-verdict',
    ],
  },
  {
    type: 'category',
    label: 'Assurance',
    collapsed: false,
    items: [
      'assurance/assurance-model',
    ],
  },
  {
    type: 'category',
    label: 'Reference',
    collapsed: true,
    items: [
      'reference/source-anchors',
    ],
  },
];

module.exports = {
  architectureSidebar,
};
