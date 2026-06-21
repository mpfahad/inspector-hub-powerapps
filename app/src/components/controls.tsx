import type { ReactNode, CSSProperties } from 'react';

const base: CSSProperties = {
  fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', sans-serif",
  fontSize: 14,
  boxSizing: 'border-box',
};

export const theme = {
  colors: {
    primary: '#742774',
    primaryHover: '#5c1f5c',
    accent: '#0078d4',
    background: '#f3f2f1',
    surface: '#ffffff',
    border: '#edebe9',
    text: '#323130',
    textSecondary: '#605e5c',
    success: '#107c10',
    warning: '#ffb900',
    danger: '#d13438',
    navActive: '#e8def8',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: 4,
  shadow: '0 1.6px 3.6px rgba(0,0,0,.13), 0 0.3px 0.9px rgba(0,0,0,.11)',
};

export function screenStyle(): CSSProperties {
  return {
    ...base,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: theme.colors.background,
    color: theme.colors.text,
  };
}

export function labelStyle(): CSSProperties {
  return { fontSize: 12, fontWeight: 600, color: theme.colors.textSecondary, marginBottom: 4 };
}

export function inputStyle(): CSSProperties {
  return {
    ...base,
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius,
    background: theme.colors.surface,
  };
}

interface ControlProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}

export function BtnPrimary({ children, onClick, style }: ControlProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...base,
        padding: '8px 20px',
        background: theme.colors.primary,
        color: '#fff',
        border: 'none',
        borderRadius: theme.radius,
        cursor: 'pointer',
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function BtnDefault({ children, onClick, style }: ControlProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...base,
        padding: '8px 20px',
        background: theme.colors.surface,
        color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function IconBtn({ children, onClick }: ControlProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...base,
        padding: '6px 10px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: theme.colors.accent,
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
  disabled?: boolean;
}

export function TxtInput({ value, onChange, placeholder, multiline, type = 'text', disabled }: TextInputProps) {
  const shared = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder,
    disabled,
    style: inputStyle(),
  };
  return multiline ? <textarea {...shared} rows={3} /> : <input type={type} {...shared} />;
}

interface DropdownProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  label?: string;
}

export function CmbDropdown({ value, options, onChange, label }: DropdownProps) {
  return (
    <div style={{ marginBottom: theme.spacing.sm }}>
      {label && <div style={labelStyle()}>{label}</div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle(), cursor: 'pointer' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

interface GalleryProps<T> {
  items: T[];
  template: (item: T, index: number) => ReactNode;
  onSelect?: (item: T) => void;
  selectedId?: number;
  emptyText?: string;
}

export function Gallery<T extends { ID: number }>({
  items,
  template,
  onSelect,
  selectedId,
  emptyText = 'No records',
}: GalleryProps<T>) {
  if (items.length === 0) {
    return (
      <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: theme.colors.textSecondary }}>
        {emptyText}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
      {items.map((item, i) => (
        <div
          key={item.ID}
          role="button"
          tabIndex={0}
          onClick={() => onSelect?.(item)}
          onKeyDown={(e) => e.key === 'Enter' && onSelect?.(item)}
          style={{
            background: selectedId === item.ID ? theme.colors.navActive : theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius,
            padding: theme.spacing.md,
            cursor: onSelect ? 'pointer' : 'default',
            boxShadow: theme.shadow,
          }}
        >
          {template(item, i)}
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: theme.colors.success,
    'In Progress': theme.colors.accent,
    Scheduled: '#8764b8',
    Completed: theme.colors.textSecondary,
    Pending: theme.colors.warning,
    Approved: theme.colors.success,
    Proposed: theme.colors.warning,
    Confirmed: theme.colors.accent,
    Critical: theme.colors.danger,
    Valid: theme.colors.success,
    'Expiring Soon': theme.colors.warning,
    Expired: theme.colors.danger,
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: `${colors[status] ?? theme.colors.border}22`,
        color: colors[status] ?? theme.colors.text,
      }}
    >
      {status}
    </span>
  );
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ height: 8, background: theme.colors.border, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: theme.colors.accent, borderRadius: 4 }} />
    </div>
  );
}

export function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontSize: 14 }}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function KpiTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        background: theme.colors.surface,
        borderRadius: theme.radius,
        padding: theme.spacing.md,
        boxShadow: theme.shadow,
        flex: 1,
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, margin: '4px 0' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>{sub}</div>}
    </div>
  );
}
