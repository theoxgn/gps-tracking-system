import React from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  ArrowUp, 
  CornerUpRight, 
  CornerUpLeft,
  RotateCw,
  RotateCcw,
  CheckSquare,
  Map,
  Flag,
  Milestone
} from 'lucide-react';

/**
 * Komponen untuk menampilkan petunjuk arah perjalanan
 * @param {Object} props - Component props
 * @param {Array} props.instructions - Instruksi rute dari API
 * @param {String} props.className - Class CSS tambahan
 */
const RouteInstructions = ({ instructions, className = '' }) => {
  if (!instructions || instructions.length === 0) {
    return (
      <div className={`route-instructions ${className}`}>
        <h3 className="text-lg font-semibold mb-3 text-blue-600 border-b pb-2">Petunjuk Rute</h3>
        <div className="text-gray-500 text-center py-4">
          Tidak ada instruksi rute tersedia
        </div>
      </div>
    );
  }

  // Fungsi untuk mendapatkan ikon berdasarkan tipe instruksi
  const getDirectionIcon = (instruction) => {
    const type = instruction.type || '';
    const modifier = instruction.modifier || '';
    
    // Tentukan ukuran ikon
    const size = 18;
    
    // Buat mapping tipe instruksi ke ikon
    switch (type.toLowerCase()) {
      case 'depart':
      case 'head':
        return <Flag size={size} color="#22c55e" />;
      case 'turn':
        if (modifier.includes('right')) {
          return <ArrowRight size={size} />;
        } else if (modifier.includes('left')) {
          return <ArrowLeft size={size} />;
        } else if (modifier.includes('straight')) {
          return <ArrowUp size={size} />;
        }
        return <ArrowUp size={size} />;
      case 'new name':
      case 'continue':
        return <ArrowUp size={size} />;
      case 'roundabout':
      case 'rotary':
        return <RotateCw size={size} />;
      case 'arrive':
      case 'destination':
        return <CheckSquare size={size} color="#ef4444" />;
      case 'slight right':
        return <CornerUpRight size={size} />;
      case 'slight left':
        return <CornerUpLeft size={size} />;
      case 'uturn':
        return <RotateCcw size={size} />;
      case 'merge':
        return <ArrowRight size={size} />;
      case 'fork':
        if (modifier.includes('right')) {
          return <CornerUpRight size={size} />;
        } else if (modifier.includes('left')) {
          return <CornerUpLeft size={size} />;
        }
        return <Map size={size} />;
      case 'end of road':
        return <Milestone size={size} color="#3b82f6" />;
      default:
        return <Map size={size} />;
    }
  };

  // Fungsi untuk memformat jarak
  const formatDistance = (distance) => {
    if (!distance && distance !== 0) return '';
    
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    } else {
      return `${(distance / 1000).toFixed(1)} km`;
    }
  };

  // Fungsi untuk memformat durasi
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) {
      return '< 1 min';
    } else if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours} jam${remainingMinutes > 0 ? ` ${remainingMinutes} min` : ''}`;
    }
  };

  // Ekstrak instuksi yang berarti (hilangkan langkah kosong)
  const meaningfulInstructions = instructions.filter(
    instruction => instruction.instruction && instruction.instruction.trim() !== ''
  );

  return (
    <div className={`route-instructions ${className}`}>
      <h3 className="text-lg font-semibold mb-3 text-blue-600 border-b pb-2">Petunjuk Rute</h3>
      <ul className="space-y-3">
        {meaningfulInstructions.map((instruction, index) => (
          <li 
            key={index} 
            className={`flex items-start p-2 rounded-lg hover:bg-gray-50 border ${
              index === 0 ? 'border-green-200 bg-green-50' : 
              index === meaningfulInstructions.length - 1 ? 'border-red-200 bg-red-50' : 
              'border-gray-100'
            }`}
          >
            <div className={`mr-3 mt-1 p-1 rounded-md ${
              index === 0 ? 'bg-green-100 text-green-600' : 
              index === meaningfulInstructions.length - 1 ? 'bg-red-100 text-red-600' : 
              'bg-blue-100 text-blue-600'
            }`}>
              {getDirectionIcon(instruction)}
            </div>
            <div className="flex-1">
              <p className="text-gray-800 font-medium">{instruction.instruction}</p>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {instruction.name && instruction.name !== '' && `Jalan ${instruction.name}`}
                </span>
                <div className="flex items-center gap-2">
                  {instruction.duration > 0 && (
                    <span className="text-xs text-gray-500">
                      {formatDuration(instruction.duration)}
                    </span>
                  )}
                  {instruction.distance > 0 && (
                    <span className="text-xs text-gray-500 font-semibold">
                      {formatDistance(instruction.distance)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RouteInstructions;