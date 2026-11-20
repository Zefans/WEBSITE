import React from 'react';
import { PROVIDERS } from '../data/signalData';
import { getProviderColor } from '../utils/colorScale';

export default function ProviderSelector({ selected, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {PROVIDERS.map((provider) => {
        const isActive = selected === provider;
        const color = getProviderColor(provider);
        return (
          <button
            key={provider}
            onClick={() => onChange(provider)}
            style={{
              padding: '10px 20px',
              border: isActive ? '2px solid transparent' : '2px solid #e0e0e0',
              borderRadius: '24px',
              background: isActive ? color : 'white',
              color: isActive ? 'white' : '#616161',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              transform: isActive ? 'translateY(-1px)' : 'none',
              boxShadow: isActive
                ? '0 3px 10px rgba(0,0,0,0.2)'
                : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : color,
                marginRight: '8px',
                verticalAlign: 'middle',
              }}
            />
            {provider}
          </button>
        );
      })}
    </div>
  );
}
