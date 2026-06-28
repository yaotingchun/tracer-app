'use client';

import { useState } from 'react';
import styles from './reports.module.css';

interface FilterState {
  timeRange: string;
  repo: string;
  team: string;
  riskLevel: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const TIME_RANGES = ['Today', 'Last 7 Days', 'Last 30 Days'];
const REPOS       = ['All Repositories', 'frontend-app', 'payment-service', 'auth-service', 'analytics'];
const TEAMS       = ['All Teams', 'Frontend', 'Backend', 'Data', 'Security'];
const RISK_LEVELS = ['All Risks', 'Low', 'Medium', 'High'];

interface SelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

function FilterSelect({ id, label, value, options, onChange }: SelectProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.filterSelect} id={id}>
      <button
        className={styles.filterSelectBtn}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className={styles.filterSelectLabel}>{label}</span>
        <span className={styles.filterSelectValue}>{value}</span>
        <span className={`${styles.filterSelectChevron} ${open ? styles.filterSelectChevronOpen : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </button>
      {open && (
        <div className={styles.filterDropdown} role="listbox">
          {options.map(opt => (
            <button
              key={opt}
              role="option"
              aria-selected={opt === value}
              className={`${styles.filterOption} ${opt === value ? styles.filterOptionActive : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const ExportIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );

  return (
    <div className={styles.filterBar} role="search" aria-label="Report filters">
      <div className={styles.filterBarLeft}>
        <FilterSelect
          id="filter-time-range"
          label="Time Range"
          value={filters.timeRange}
          options={TIME_RANGES}
          onChange={v => onChange({ ...filters, timeRange: v })}
        />
        <FilterSelect
          id="filter-repo"
          label="Repository"
          value={filters.repo}
          options={REPOS}
          onChange={v => onChange({ ...filters, repo: v })}
        />
        <FilterSelect
          id="filter-team"
          label="Team"
          value={filters.team}
          options={TEAMS}
          onChange={v => onChange({ ...filters, team: v })}
        />
        <FilterSelect
          id="filter-risk"
          label="Risk Level"
          value={filters.riskLevel}
          options={RISK_LEVELS}
          onChange={v => onChange({ ...filters, riskLevel: v })}
        />
      </div>
      <button className={styles.exportBtn} id="export-report-btn" aria-label="Export report">
        <ExportIcon />
        Export
      </button>
    </div>
  );
}

export type { FilterState };
