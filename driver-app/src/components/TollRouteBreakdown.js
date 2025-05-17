import React from 'react';
import { MapPinned } from 'lucide-react';

/**
 * Komponen untuk menampilkan rincian ruas tol beserta tarifnya
 * @param {Object} props - Component props
 * @param {Array} props.tollSegments - Segmen tol yang dilewati
 * @param {String} props.vehicleClass - Golongan kendaraan
 * @param {Number} props.totalEstimation - Total estimasi biaya
 * @param {Boolean} props.isLoading - Status loading data
 * @param {Object} props.style - Style tambahan
 */
const TollRouteBreakdown = ({ 
  tollSegments = [], 
  vehicleClass = 'gol1',
  totalEstimation = 0,
  isLoading = false,
  style = {} 
}) => {
  // Konversi kode golongan ke label yang lebih user-friendly
  const getVehicleClassLabel = (code) => {
    switch(code) {
      case 'gol1': return 'I (Sedan/Jeep/Pickup)';
      case 'gol2': return 'II (Truk 2 sumbu)';
      case 'gol3': return 'III (Truk 3 sumbu)';
      case 'gol4': return 'IV (Truk 4 sumbu)';
      case 'gol5': return 'V (Truk 5+ sumbu)';
      default: return code;
    }
  };

  // Jika tidak ada segmen tol
  if (tollSegments.length === 0 && !isLoading) {
    return (
      <div style={{
        padding: '12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        marginBottom: '16px',
        ...style
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '8px',
          color: '#4b5563',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          <MapPinned size={16} style={{ marginRight: '8px' }} />
          Informasi Ruas Tol
        </div>
        <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '8px' }}>
          Tidak ada informasi ruas tol untuk rute ini
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px',
      backgroundColor: '#f3f4f6',
      borderRadius: '8px',
      marginBottom: '16px',
      ...style
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          color: '#1d4ed8',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          <MapPinned size={16} style={{ marginRight: '8px' }} />
          Rincian Ruas Tol
        </div>
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          backgroundColor: '#e5e7eb',
          padding: '4px 8px',
          borderRadius: '12px'
        }}>
          Golongan {getVehicleClassLabel(vehicleClass)}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      ) : (
        <>
          <div style={{
            borderBottom: '1px solid #d1d5db',
            marginBottom: '8px',
            paddingBottom: '8px'
          }}>
            {tollSegments.map((segment, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                <div style={{ flex: 1 }}>{segment.name}</div>
                <div style={{ fontWeight: '500' }}>± Rp {segment.cost.toLocaleString('id-ID')}</div>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 'bold',
            color: '#1d4ed8',
            fontSize: '16px'
          }}>
            <div>Total Estimasi:</div>
            <div>± Rp {totalEstimation.toLocaleString('id-ID')}</div>
          </div>

          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '8px',
            fontStyle: 'italic'
          }}>
            * Tarif dapat berubah sewaktu-waktu. Harap verifikasi dengan informasi resmi.
          </div>
        </>
      )}
    </div>
  );
};

export default TollRouteBreakdown;