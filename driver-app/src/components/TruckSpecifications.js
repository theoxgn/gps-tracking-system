import React from 'react';

/**
 * Komponen untuk input spesifikasi truk
 * @param {Object} props - Component props
 * @param {Object} props.truckSpecs - Spesifikasi truk saat ini
 * @param {Function} props.onUpdate - Callback ketika nilai diperbarui
 * @param {Object} props.style - Style tambahan
 */
const TruckSpecifications = ({ truckSpecs, onUpdate, style = {} }) => {
  // Default specs jika tidak disediakan
  const specs = truckSpecs || {
    height: 4.2,  // meter
    weight: 16,   // ton
    width: 2.5,   // meter
    length: 12,   // meter
    axles: 2      // jumlah sumbu
  };
  
  // Handler untuk update nilai
  const handleChange = (field, value) => {
    if (onUpdate) {
      onUpdate({
        ...specs,
        [field]: parseFloat(value)
      });
    }
  };
  
  return (
    <div style={{
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid #e2e8f0',
      ...style
    }}>
      <div style={{
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#3b82f6',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13"></rect>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
        Spesifikasi Truk
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px'
      }}>
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            color: '#4b5563',
            marginBottom: '4px'
          }}>
            Tinggi (meter)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={specs.height}
            onChange={(e) => handleChange('height', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            color: '#4b5563',
            marginBottom: '4px'
          }}>
            Berat (ton)
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={specs.weight}
            onChange={(e) => handleChange('weight', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            color: '#4b5563',
            marginBottom: '4px'
          }}>
            Lebar (meter)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={specs.width}
            onChange={(e) => handleChange('width', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            color: '#4b5563',
            marginBottom: '4px'
          }}>
            Panjang (meter)
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={specs.length}
            onChange={(e) => handleChange('length', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            color: '#4b5563',
            marginBottom: '4px'
          }}>
            Jumlah Sumbu
          </label>
          <select
            value={specs.axles}
            onChange={(e) => handleChange('axles', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              fontSize: '14px'
            }}
          >
            <option value="2">2 sumbu</option>
            <option value="3">3 sumbu</option>
            <option value="4">4 sumbu</option>
            <option value="5">5 sumbu</option>
            <option value="6">6 sumbu atau lebih</option>
          </select>
        </div>
      </div>
      
      <div style={{
        marginTop: '12px',
        fontSize: '13px',
        color: '#6b7280',
        fontStyle: 'italic'
      }}>
        * Spesifikasi digunakan untuk mengestimasi waktu tempuh dan memberikan peringatan rute
      </div>
    </div>
  );
};

export default TruckSpecifications;