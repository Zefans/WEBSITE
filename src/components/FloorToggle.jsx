import React from 'react';

const FLOORS = [
  { value: 1, label: 'Lantai 1' },
  { value: 2, label: 'Lantai 2' },
];

export default function FloorToggle({ selected = 1, onChange }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '2px solid #0d47a1',
      }}
    >
      {FLOORS.map((floor) => {
        const isActive = selected === floor.value;
        return (
          <button
            key={floor.value}
            onClick={() => onChange(floor.value)}
            style={{
              padding: '8px 24px',
              border: 'none',
              background: isActive ? '#0d47a1' : 'white',
              color: isActive ? 'white' : '#0d47a1',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = '#e3f2fd';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'white';
              }
            }}
          >
            {floor.label}
          </button>
        );
      })}
    </div>
  );
}
