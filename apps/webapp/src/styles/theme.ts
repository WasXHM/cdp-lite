import type { ThemeConfig } from 'antd';

export const workspaceTokens = {
  canvas: '#eef1f5', surface: '#ffffff', ink: '#303846', muted: '#667180', subtle: '#98a2b0',
  border: '#e2e6ec', 'control-border': '#a4afbd', inset: '#f7f8fa',
  header: '#2b3445', 'header-ink': '#e4e8ef', 'header-active': '#78a9ff',
  'accent-soft': '#f0f5ff', 'accent-border': '#c7d8fa', accent: '#2864d7', 'accent-hover': '#1d50b0',
  'warning-bg': '#fff8e8', 'warning-fg': '#9a6700', 'danger-bg': '#fff1f2', 'danger-fg': '#c22f49',
  'radius-sm': '2px', 'radius-control': '2px', 'radius-panel': '2px',
  'shadow-popup': '0 4px 16px rgb(28 39 58 / 12%)',
  'sidebar-width': '180px', 'topbar-height': '52px', 'page-padding': '12px',
  'control-height': '32px', 'control-height-mobile': '40px',
  'font-sans': '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  'font-mono': '"SFMono-Regular", Consolas, monospace',
  'font-body': '14px', 'font-helper': '12px', 'font-title': '16px',
  'motion-fast': '120ms', 'motion-base': '180ms',
} as const;

export function installWorkspaceTokens() {
  for (const [name, value] of Object.entries(workspaceTokens)) document.documentElement.style.setProperty(`--workspace-${name}`, value);
}

export const workspaceTheme: ThemeConfig = {
  token: {
    colorPrimary: workspaceTokens.accent, colorInfo: workspaceTokens.accent,
    colorPrimaryHover: workspaceTokens['accent-hover'], colorPrimaryActive: workspaceTokens['accent-hover'],
    colorSuccess: workspaceTokens.accent, colorWarning: workspaceTokens['warning-fg'], colorError: workspaceTokens['danger-fg'],
    colorText: workspaceTokens.ink, colorTextSecondary: workspaceTokens.muted, colorTextPlaceholder: workspaceTokens.muted,
    colorBorder: workspaceTokens['control-border'], colorBorderSecondary: workspaceTokens.border,
    colorBgLayout: workspaceTokens.canvas, colorBgContainer: workspaceTokens.surface,
    colorFillAlter: workspaceTokens.inset, colorLink: workspaceTokens.accent, colorLinkHover: workspaceTokens['accent-hover'],
    borderRadius: 2, borderRadiusLG: 2, borderRadiusSM: 2,
    controlHeight: 32, controlHeightSM: 28, fontSize: 14, fontFamily: workspaceTokens['font-sans'],
    motionDurationFast: workspaceTokens['motion-fast'], motionDurationMid: workspaceTokens['motion-base'],
    boxShadow: workspaceTokens['shadow-popup'], boxShadowSecondary: workspaceTokens['shadow-popup'],
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 400, paddingInline: 12 },
    Form: { itemMarginBottom: 12, labelColor: workspaceTokens.muted, labelFontSize: 13, verticalLabelPadding: '0 0 4px' },
    Table: { headerBg: workspaceTokens.inset, headerColor: workspaceTokens.muted, cellPaddingBlock: 8, cellPaddingInline: 12, cellPaddingBlockSM: 6, cellPaddingInlineSM: 12, rowHoverBg: workspaceTokens['accent-soft'] },
    Tag: { defaultBg: workspaceTokens.inset, defaultColor: workspaceTokens.muted },
    Select: { optionSelectedBg: workspaceTokens['accent-soft'], optionSelectedColor: workspaceTokens.accent },
    Alert: { colorInfoBg: workspaceTokens['accent-soft'], colorInfoBorder: workspaceTokens['accent-border'], colorSuccessBg: workspaceTokens['accent-soft'], colorSuccessBorder: workspaceTokens['accent-border'], colorErrorBg: workspaceTokens['danger-bg'], colorWarningBg: workspaceTokens['warning-bg'] },
    Modal: { paddingContentHorizontalLG: 20 },
  },
};
