import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

/**
 * Komponen untuk menampilkan rute lengkap di peta menggunakan GraphHopper atau OSRM
 * @param {Object} props - Component props
 * @param {Array} props.startPoint - Koordinat awal [lat, lng]
 * @param {Array} props.endPoint - Koordinat akhir [lat, lng]
 * @param {String} props.transportMode - Mode transportasi
 * @param {Boolean} props.preferTollRoads - Preferensi penggunaan jalan tol
 * @param {Object} props.truckSpecs - Spesifikasi truk (tinggi, berat, dll)
 * @param {Object} props.socket - Socket.io instance untuk komunikasi dengan server
 * @param {String} props.driverId - ID driver
 * @param {Function} props.onRouteCalculated - Callback setelah kalkulasi rute (optional)
 */
const DetailedRouteMap = ({ 
  startPoint, 
  endPoint, 
  transportMode = 'driving-car',
  preferTollRoads = true, // Default: prioritaskan jalan tol
  truckSpecs = null,
  socket = null,
  driverId = null,
  onRouteCalculated = null
}) => {
  // State untuk menyimpan rute
  const [routeGeometry, setRouteGeometry] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [truckWarnings, setTruckWarnings] = useState([]);
  const [isTruckRoute, setIsTruckRoute] = useState(false);
  const [usesToll, setUsesToll] = useState(false);
  const [tollInfo, setTollInfo] = useState(null);
  
  // State untuk menyimpan rute alternatif (toll dan non-toll) - untuk ESLint
  const [availableRoutes, setAvailableRoutes] = useState({
    tollRoute: null,
    nonTollRoute: null
  });
  
  // Gunakan ref untuk mencegah perhitungan ulang yang tidak perlu
  const prevPropsRef = useRef({ 
    startPoint, 
    endPoint, 
    transportMode, 
    preferTollRoads 
  });
  
  // Ref untuk menyimpan rute alternatif - untuk menghindari infinite loop
  const availableRoutesRef = useRef({
    tollRoute: null,
    nonTollRoute: null
  });
  
  const routeCalculatedRef = useRef(false);
  
  // Ref untuk map instance
  const map = useMap();

  // Ref untuk menandai apakah GraphHopper request telah dikirim
  const graphhopperRequestSent = useRef(false);
  
  // Efek untuk mendeteksi jika mode transportasi adalah truk
  useEffect(() => {
    setIsTruckRoute(transportMode === 'driving-hgv');
  }, [transportMode]);

  /**
   * Periksa apakah rute kemungkinan menggunakan jalan tol
   * @param {Object} route - Data rute dari OSRM
   * @returns {Boolean} - Apakah rute menggunakan tol
   */
  const checkIfRouteLikelyUsesToll = useCallback((route) => {
    if (!route || !route.legs || !route.legs.length) return false;
    
    let hasTollRoad = false;
    
    // Cek di instruksi dan nama jalan
    for (const leg of route.legs) {
      if (!leg.steps || !leg.steps.length) continue;
      
      for (const step of leg.steps) {
        const name = step.name?.toLowerCase() || '';
        
        // Cek apakah nama jalan mengandung kata kunci tol
        if (name.includes('tol') || 
            name.includes('highway') || 
            name.includes('motorway') ||
            name.includes('jalan bebas hambatan') ||
            name.includes('exit') || // Biasanya exit dari jalan tol
            name.includes('toll')) {
          hasTollRoad = true;
          break;
        }
      }
      
      if (hasTollRoad) break;
    }
    
    // Jika belum terdeteksi, cek ciri-ciri rute tol (biasanya lebih cepat dengan jarak yang jauh)
    if (!hasTollRoad) {
      const distance = route.distance / 1000; // km
      const duration = route.duration / 60; // menit
      
      // Jika rute cukup jauh (>10km) dan rata-rata kecepatan > 70 km/h, kemungkinan menggunakan tol
      if (distance > 10 && duration > 0) {
        const avgSpeed = distance / (duration / 60); // km/h
        if (avgSpeed > 70) {
          hasTollRoad = true;
        }
      }
    }
    
    return hasTollRoad;
  }, []);

  // Deteksi potensi bahaya untuk truk
  const detectTruckHazards = useCallback((routeGeometry, usesToll) => {
    const warnings = [];
    
    if (!routeGeometry || routeGeometry.length < 3) {
      return warnings;
    }
    
    // Penambahan peringatan informasi dasar
    warnings.push({
      type: 'info',
      message: 'Rute ini menggunakan profile mobil dari GraphHopper. Durasi telah disesuaikan +30% untuk truk.',
      severity: 'info'
    });
    
    // Tambahkan informasi tentang penggunaan tol
    if (usesToll) {
      warnings.push({
        type: 'toll',
        message: 'Rute ini menggunakan jalan tol. Biaya tol berdasarkan golongan kendaraan Anda.',
        severity: 'info'
      });
    }
    
    // Cek tiap 3 titik berurutan untuk mendeteksi tikungan tajam
    let sharpTurnCount = 0;
    for (let i = 0; i < routeGeometry.length - 2; i += 2) { // Skip beberapa titik untuk efisiensi
      if (i + 2 >= routeGeometry.length) break;
      
      const p1 = routeGeometry[i];
      const p2 = routeGeometry[i+1];
      const p3 = routeGeometry[i+2];
      
      // Hitung sudut antara 3 titik
      const angle = calculateAngle(p1, p2, p3);
      
      // Jika sudut sangat tajam (< 60 derajat), tandai sebagai berbahaya
      if (angle < 60) {
        sharpTurnCount++;
        
        // Batasi jumlah peringatan tikungan tajam untuk menghindari terlalu banyak peringatan
        if (sharpTurnCount <= 3) {
          warnings.push({
            type: 'sharp_turn',
            message: `Tikungan tajam terdeteksi (${angle.toFixed(0)}°)`,
            severity: angle < 40 ? 'high' : 'medium',
            location: p2
          });
        }
      }
    }
    
    // Jika terlalu banyak tikungan tajam, tambahkan ringkasan
    if (sharpTurnCount > 3) {
      warnings.push({
        type: 'sharp_turns_summary',
        message: `Terdeteksi total ${sharpTurnCount} tikungan tajam di sepanjang rute`,
        severity: 'medium'
      });
    }
    
    // Tambahkan peringatan tentang kemungkinan hambatan
    warnings.push({
      type: 'dimensions',
      message: `Verifikasi batasan tinggi, berat, dan lebar di sepanjang rute`,
      severity: 'medium'
    });
    
    return warnings;
  }, []);

  /**
   * Menghitung sudut antara 3 titik dalam derajat
   */
  const calculateAngle = (p1, p2, p3) => {
    // Hitung vektor dari p2 ke p1 dan p2 ke p3
    const v1 = [p1[0] - p2[0], p1[1] - p2[1]];
    const v2 = [p3[0] - p2[0], p3[1] - p2[1]];
    
    // Hitung dot product
    const dotProduct = v1[0] * v2[0] + v1[1] * v2[1];
    
    // Hitung magnitudes
    const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
    const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
    
    // Hindari pembagian dengan nol
    if (mag1 === 0 || mag2 === 0) return 180;
    
    // Hitung cosine dari sudut
    const cosAngle = dotProduct / (mag1 * mag2);
    
    // Konversi ke sudut dalam derajat
    const angleRad = Math.acos(Math.min(Math.max(cosAngle, -1), 1));
    const angleDeg = angleRad * 180 / Math.PI;
    
    return angleDeg;
  };
  
  // Event handler untuk menerima respons rute dari GraphHopper
  const handleGraphhopperResponse = useCallback((routeData) => {
    console.log('Received GraphHopper route response:', routeData);
    setIsLoading(false);
    graphhopperRequestSent.current = false;
    
    if (!routeData || routeData.error) {
      console.error('GraphHopper error:', routeData?.error || 'Unknown error');
      setError(routeData?.error || 'Error calculating route');
      
      // Fallback ke rute OSRM jika GraphHopper gagal
      console.log('Falling back to OSRM route calculation');
      fetchOsrmRoute(startPoint, endPoint, transportMode, preferTollRoads);
      return;
    }
    
    // Set rute geometri
    if (routeData.routeGeometry && routeData.routeGeometry.length > 0) {
      setRouteGeometry(routeData.routeGeometry);
      
      // Sesuaikan peta untuk menampilkan seluruh rute
      if (map) {
        try {
          const bounds = L.latLngBounds(routeData.routeGeometry);
          map.fitBounds(bounds, { padding: [50, 50] });
        } catch (e) {
          console.error('Error fitting bounds:', e);
        }
      }
    }
    
    // Set status penggunaan tol
    const usesToll = routeData.tollInfo && routeData.tollInfo.usesToll;
    setUsesToll(usesToll);
    
    // Set informasi biaya tol
    if (usesToll) {
      setTollInfo(routeData.tollInfo);
    } else {
      setTollInfo(null);
    }
    
    // Generate peringatan untuk truk jika diperlukan
    if (transportMode === 'driving-hgv') {
      const warnings = [
        ...detectTruckHazards(routeData.routeGeometry, usesToll)
      ];
      
      // Tambahkan info biaya tol ke peringatan
      if (usesToll && routeData.tollInfo && routeData.tollInfo.estimatedCost) {
        warnings.push({
          type: 'toll_cost',
          message: `Estimasi biaya tol: Rp ${routeData.tollInfo.estimatedCost.toLocaleString('id-ID')} (Golongan ${getVehicleClassLabel(routeData.tollInfo.vehicleClass)})`,
          severity: 'info'
        });
      }
      
      setTruckWarnings(warnings);
    } else {
      setTruckWarnings([]);
    }
    
    // Set status rute sudah dihitung
    routeCalculatedRef.current = true;
    
    // Panggil callback jika tersedia
    if (onRouteCalculated) {
      onRouteCalculated({
        distance: routeData.distance,
        duration: routeData.duration,
        instructions: routeData.instructions || [],
        routeGeometry: routeData.routeGeometry,
        truckWarnings: transportMode === 'driving-hgv' ? truckWarnings : null,
        usesToll: usesToll,
        tollInfo: routeData.tollInfo || null
      });
    }
  }, [startPoint, endPoint, transportMode, map, detectTruckHazards, truckWarnings, onRouteCalculated]);
  
  // Event handler untuk error dari GraphHopper
  const handleGraphhopperError = useCallback((errorData) => {
    console.error('GraphHopper route error:', errorData);
    setIsLoading(false);
    graphhopperRequestSent.current = false;
    setError(errorData?.error || 'Error calculating route');
    
    // Fallback ke OSRM jika GraphHopper gagal
    console.log('Falling back to OSRM route calculation');
    fetchOsrmRoute(startPoint, endPoint, transportMode, preferTollRoads);
  }, [startPoint, endPoint, transportMode, preferTollRoads]);
  
  // Setup socket event listeners untuk GraphHopper
  useEffect(() => {
    if (!socket) return;
    
    // Setup event listeners
    socket.on('routeWithTollResponse', handleGraphhopperResponse);
    socket.on('routeError', handleGraphhopperError);
    
    // Cleanup saat unmount
    return () => {
      socket.off('routeWithTollResponse', handleGraphhopperResponse);
      socket.off('routeError', handleGraphhopperError);
    };
  }, [socket, handleGraphhopperResponse, handleGraphhopperError]);

  // Fungsi untuk mengambil rute dari GraphHopper via socket
  const fetchGraphhopperRoute = useCallback((start, end, mode, preferToll) => {
    if (!socket || !socket.connected) {
      console.log('Socket not connected, falling back to OSRM');
      fetchOsrmRoute(start, end, mode, preferToll);
      return;
    }
    
    // Tandai bahwa request sedang dalam proses
    graphhopperRequestSent.current = true;
    setIsLoading(true);
    setError(null);
    
    console.log('Requesting route from GraphHopper via socket:', {
      startPoint: start, 
      endPoint: end, 
      mode, 
      preferToll,
      truckSpecs: mode === 'driving-hgv' ? truckSpecs : null
    });
    
    // Siapkan data untuk request
    const routeRequest = {
      deviceID: driverId || 'unknown',
      startPoint: start,
      endPoint: end,
      transportMode: mode,
      preferTollRoads: preferToll,
      truckSpecs: mode === 'driving-hgv' ? truckSpecs : null
    };
    
    // Emit event ke server
    socket.emit('requestRouteWithToll', routeRequest);
    
    // Set timeout untuk fallback ke OSRM jika tidak ada respons dalam 5 detik
    setTimeout(() => {
      if (graphhopperRequestSent.current) {
        console.log('GraphHopper request timed out, falling back to OSRM');
        graphhopperRequestSent.current = false;
        fetchOsrmRoute(start, end, mode, preferToll);
      }
    }, 5000);
  }, [socket, driverId, truckSpecs]);
  
  // Fungsi asli untuk mengambil rute dari OSRM jika GraphHopper gagal
  const fetchOsrmRoute = useCallback(async (start, end, mode, preferToll = true) => {
    if (!start || !end) return;
    
    // Check if toll preference changed specifically
    const tollPreferenceChanged = prevPropsRef.current.preferTollRoads !== preferToll;
    
    // Skip jika tidak ada perubahan input
    const propsChanged = 
      !prevPropsRef.current.startPoint ||
      !prevPropsRef.current.endPoint ||
      prevPropsRef.current.startPoint[0] !== start[0] ||
      prevPropsRef.current.startPoint[1] !== start[1] ||
      prevPropsRef.current.endPoint[0] !== end[0] ||
      prevPropsRef.current.endPoint[1] !== end[1] ||
      prevPropsRef.current.transportMode !== mode;
    
    // Only skip if absolutely nothing changed
    if (!propsChanged && !tollPreferenceChanged && routeCalculatedRef.current) {
      console.log('Skipping route calculation - inputs unchanged');
      return;
    }
    
    // Perbarui ref dengan semua nilai termasuk preferensi tol
    prevPropsRef.current = { 
      startPoint: start ? [...start] : null, 
      endPoint: end ? [...end] : null, 
      transportMode: mode,
      preferTollRoads: preferToll
    };
    
    setIsLoading(true);
    setError(null);
    setTruckWarnings([]);
    
    try {
      // OSRM mengharapkan format [lng, lat], bukan [lat, lng]
      const startCoord = `${start[1]},${start[0]}`; 
      const endCoord = `${end[1]},${end[0]}`;
      
      // Map transportMode ke profile OSRM
      const profile = mapTransportModeToOsrmProfile(mode);
      
      // Tambahkan parameter khusus untuk truk, hanya parameter yang didukung OSRM
      const extraParams = mode === 'driving-hgv' ? {
        continue_straight: true // Hanya parameter ini yang valid di OSRM public API
      } : {};
      
      // Buat URL untuk request OSRM public API
      const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startCoord};${endCoord}`;
      
      console.log('Fetching OSRM route for mode:', mode, 'with toll preference:', preferToll);
      
      // Selalu minta rute alternatif untuk bisa memilih yang tol atau non-tol
      const requestParams = {
        steps: true,
        geometries: 'geojson',
        overview: 'full',
        annotations: true,
        alternatives: true, // Selalu minta alternatif
        ...extraParams
      };
      
      const response = await axios.get(osrmUrl, { params: requestParams });
      
      // Periksa data valid
      if (response.data && 
          response.data.routes && 
          response.data.routes.length > 0) {
        
        // Identifikasi rute mana yang menggunakan tol dan yang tidak
        const routesWithTollInfo = response.data.routes.map((route, index) => {
          const hasToll = checkIfRouteLikelyUsesToll(route);
          const geometry = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
          const instructions = extractRouteInstructions(route);
          const distance = route.distance / 1000; // km
          const duration = Math.round(route.duration / 60); // menit
          
          // Sesuaikan durasi untuk truk
          const adjustedDuration = mode === 'driving-hgv' ? Math.round(duration * 1.3) : duration;
          
          return {
            index,
            route,
            hasToll,
            geometry,
            instructions,
            distance,
            duration: adjustedDuration,
            originalDuration: duration
          };
        });
        
        console.log("Route alternatives toll info:", routesWithTollInfo.map(r => 
          `Route ${r.index}: ${r.hasToll ? 'Uses toll' : 'No toll'}, Distance: ${r.distance.toFixed(1)}km`
        ));
        
        // Cari rute tol dan non-tol terbaik
        let bestTollRoute = null;
        let bestNonTollRoute = null;
        
        // Cari rute tol terbaik (paling pendek)
        const tollRoutes = routesWithTollInfo.filter(r => r.hasToll);
        if (tollRoutes.length > 0) {
          bestTollRoute = tollRoutes.reduce((prev, curr) => 
            prev.distance < curr.distance ? prev : curr
          );
        }
        
        // Cari rute non-tol terbaik (paling pendek)
        const nonTollRoutes = routesWithTollInfo.filter(r => !r.hasToll);
        if (nonTollRoutes.length > 0) {
          bestNonTollRoute = nonTollRoutes.reduce((prev, curr) => 
            prev.distance < curr.distance ? prev : curr
          );
        }
        
        // Jika tidak ada rute dengan karakteristik tol yang jelas, gunakan rute default
        if (!bestTollRoute) {
          console.log("No clear toll routes detected, using shortest route as toll route");
          bestTollRoute = routesWithTollInfo[0]; // Rute terpendek sebagai default
        }
        
        if (!bestNonTollRoute) {
          console.log("No clear non-toll routes detected, using longest route as non-toll route");
          // Gunakan rute terpanjang sebagai rute non-tol
          bestNonTollRoute = [...routesWithTollInfo].sort((a, b) => b.distance - a.distance)[0];
          
          // Jika hanya ada satu rute, duplikasi sebagai non-toll
          if (routesWithTollInfo.length === 1) {
            bestNonTollRoute = {...routesWithTollInfo[0], hasToll: false};
          }
        }
        
        // Simpan rute alternatif untuk penggunaan selanjutnya
        // Gunakan REF dan state untuk menghindari infinite loop
        availableRoutesRef.current = {
          tollRoute: bestTollRoute,
          nonTollRoute: bestNonTollRoute
        };
        
        // ESLint needs this, but watch out for infinite loops
        setAvailableRoutes({
          tollRoute: bestTollRoute,
          nonTollRoute: bestNonTollRoute
        });
        
        // Pilih rute yang sesuai dengan preferensi
        const selectedRoute = preferToll ? 
          (bestTollRoute || routesWithTollInfo[0]) : 
          (bestNonTollRoute || (routesWithTollInfo.length > 1 ? routesWithTollInfo[1] : routesWithTollInfo[0]));
        
        console.log(`Selected ${selectedRoute.hasToll ? 'toll' : 'non-toll'} route based on preference: ${preferToll}`);
        
        setRouteGeometry(selectedRoute.geometry);
        routeCalculatedRef.current = true;
        setUsesToll(selectedRoute.hasToll);
        
        // Reset toll info karena OSRM tidak memberikan biaya tol
        setTollInfo(null);
        
        // Sesuaikan peta untuk menampilkan seluruh rute
        if (selectedRoute.geometry.length > 0 && map) {
          try {
            const bounds = L.latLngBounds(selectedRoute.geometry);
            map.fitBounds(bounds, { padding: [50, 50] });
          } catch (e) {
            console.error('Error fitting bounds:', e);
          }
        }
        
        // Generate peringatan untuk rute truk
        let warnings = [];
        if (mode === 'driving-hgv') {
          warnings = detectTruckHazards(selectedRoute.geometry, selectedRoute.hasToll);
          setTruckWarnings(warnings);
        }
        
        // Tambahkan estimasi biaya tol berdasarkan jarak dan golongan kendaraan
        let estimatedTollInfo = null;
        if (selectedRoute.hasToll) {
          // Perkiraan jarak tol (50% dari total jarak)
          const estimatedTollDistance = selectedRoute.distance * 0.5;
          
          // Perkiraan golongan kendaraan
          const vehicleClass = mode === 'driving-hgv' ? 
            getVehicleClassFromSpecs(truckSpecs) : 1;
          
          // Perkiraan biaya berdasarkan tarif per km
          const ratePerKm = getTollRateForClass(vehicleClass);
          const estimatedCost = Math.round(estimatedTollDistance * ratePerKm);
          
          estimatedTollInfo = {
            usesToll: true,
            vehicleClass: vehicleClass,
            estimatedCost: estimatedCost,
            tollDistance: estimatedTollDistance,
            isEstimated: true
          };
          
          setTollInfo(estimatedTollInfo);
        }
        
        // Panggil callback dengan hasil
        if (onRouteCalculated) {
          onRouteCalculated({
            distance: selectedRoute.distance,
            duration: selectedRoute.duration,
            instructions: selectedRoute.instructions,
            routeGeometry: selectedRoute.geometry,
            truckWarnings: mode === 'driving-hgv' ? warnings : null,
            usesToll: selectedRoute.hasToll,
            tollInfo: estimatedTollInfo
          });
        }
      } else {
        throw new Error('Invalid route data from OSRM');
      }
    } catch (err) {
      console.error('Error fetching OSRM route:', err);
      setError(err.message);
      
      // Reset cached routes karena error - menggunakan REF
      availableRoutesRef.current = {
        tollRoute: null,
        nonTollRoute: null
      };
      
      // ESLint needs this, but watch out for infinite loops
      setAvailableRoutes({
        tollRoute: null,
        nonTollRoute: null
      });
      
      // Jika OSRM gagal, gunakan perhitungan jarak sederhana sebagai fallback
      const simpleDistance = calculateDistance(start, end);
      const avgSpeedKmh = mode === 'driving-hgv' ? 40 : 50; // Truck lebih lambat
      const durationMinutes = Math.round((simpleDistance / avgSpeedKmh) * 60);
      
      // Buat garis lurus sebagai fallback
      setRouteGeometry([start, end]);
      
      // Generate instruksi navigasi sederhana
      const simpleInstructions = generateBasicInstructions(start, end, mode);
      
      // Tambahkan peringatan untuk truk jika modenya truck
      const truckWarningsList = [];
      if (mode === 'driving-hgv') {
        truckWarningsList.push({
          type: 'fallback',
          message: 'Menggunakan rute sederhana karena tidak bisa mendapatkan rute detail. Harap verifikasi kesesuaian rute untuk kendaraan besar.',
          severity: 'warning'
        });
        setTruckWarnings(truckWarningsList);
      }
      
      // Panggil callback dengan hasil sederhana
      if (onRouteCalculated) {
        onRouteCalculated({
          distance: simpleDistance,
          duration: durationMinutes,
          instructions: simpleInstructions,
          routeGeometry: [start, end],
          truckWarnings: mode === 'driving-hgv' ? truckWarningsList : null,
          usesToll: false // Fallback tidak menggunakan tol
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [checkIfRouteLikelyUsesToll, detectTruckHazards, map, onRouteCalculated, truckSpecs]);

  // Main function to fetch route - decides whether to use GraphHopper or OSRM
  const fetchRoute = useCallback((start, end, mode, preferToll = true) => {
    if (!start || !end) return;
    
    // Coba GraphHopper dulu jika socket tersedia
    if (socket && socket.connected) {
      fetchGraphhopperRoute(start, end, mode, preferToll);
    } else {
      // Fallback ke OSRM jika socket tidak tersedia
      fetchOsrmRoute(start, end, mode, preferToll);
    }
  }, [socket, fetchGraphhopperRoute, fetchOsrmRoute]);

  // Effect khusus untuk mengubah rute saat preferensi tol berubah
  useEffect(() => {
    console.log(`Toll preference changed to: ${preferTollRoads}`);
    
    // Skip if no points set yet
    if (!startPoint || !endPoint || !map) {
      return;
    }
    
    // Jika socket tersedia, minta rute baru dari GraphHopper
    if (socket && socket.connected) {
      fetchGraphhopperRoute(startPoint, endPoint, transportMode, preferTollRoads);
      return;
    }
    
    // Jika socket tidak tersedia, gunakan caching lokal untuk tol/non-tol
    
    // !! FIXING INFINITE LOOP !!
    // Use the REF for checking, not the state
    const cachedRoutes = availableRoutesRef.current;
    
    // Tampilkan availableRoutes untuk ESLint - but don't depend on this value
    // We're using the ref value instead for logic to prevent infinite loops
    const tollRouteExists = availableRoutes.tollRoute !== null;
    const nonTollRouteExists = availableRoutes.nonTollRoute !== null;
    console.log("Current routes in state:", 
      tollRouteExists ? "Has toll route" : "No toll route",
      nonTollRouteExists ? "Has non-toll route" : "No non-toll route"
    );
    
    if (cachedRoutes.tollRoute && cachedRoutes.nonTollRoute) {
      // Use cached routes if available
      console.log("Using cached routes based on toll preference");
      
      // Select based on preference
      const selectedRoute = preferTollRoads ? 
        cachedRoutes.tollRoute : 
        cachedRoutes.nonTollRoute;
      
      console.log(`Using cached ${selectedRoute.hasToll ? 'toll' : 'non-toll'} route`);
      
      setRouteGeometry(selectedRoute.geometry);
      routeCalculatedRef.current = true;
      setUsesToll(selectedRoute.hasToll);
      
      // Reset toll info karena OSRM tidak memberikan biaya tol
      // Tambahkan estimasi biaya tol berdasarkan jarak dan golongan kendaraan
      let estimatedTollInfo = null;
      if (selectedRoute.hasToll) {
        // Perkiraan jarak tol (50% dari total jarak)
        const estimatedTollDistance = selectedRoute.distance * 0.5;
        
        // Perkiraan golongan kendaraan
        const vehicleClass = transportMode === 'driving-hgv' ? 
          getVehicleClassFromSpecs(truckSpecs) : 1;
        
        // Perkiraan biaya berdasarkan tarif per km
        const ratePerKm = getTollRateForClass(vehicleClass);
        const estimatedCost = Math.round(estimatedTollDistance * ratePerKm);
        
        estimatedTollInfo = {
          usesToll: true,
          vehicleClass: vehicleClass,
          estimatedCost: estimatedCost,
          tollDistance: estimatedTollDistance,
          isEstimated: true
        };
        
        setTollInfo(estimatedTollInfo);
      } else {
        setTollInfo(null);
      }
      
      // Generate truck warnings if needed
      let warnings = [];
      if (transportMode === 'driving-hgv') {
        warnings = detectTruckHazards(selectedRoute.geometry, selectedRoute.hasToll);
        setTruckWarnings(warnings);
      }
      
      // Notify parent
      if (onRouteCalculated) {
        onRouteCalculated({
          distance: selectedRoute.distance,
          duration: selectedRoute.duration,
          instructions: selectedRoute.instructions,
          routeGeometry: selectedRoute.geometry,
          truckWarnings: transportMode === 'driving-hgv' ? warnings : null,
          usesToll: selectedRoute.hasToll,
          tollInfo: estimatedTollInfo
        });
      }
    } else {
      // No cached routes, need to fetch
      console.log("No cached routes, fetching new routes...");
      fetchRoute(startPoint, endPoint, transportMode, preferTollRoads);
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferTollRoads, startPoint, endPoint, map, transportMode, socket, detectTruckHazards, onRouteCalculated]); 
  // DO NOT add availableRoutes here - it would cause infinite loops!

  // Jalankan fetchRoute saat komponen mount atau props berubah
  useEffect(() => {
    // Periksa validasi input
    if (!startPoint || !endPoint || !Array.isArray(startPoint) || !Array.isArray(endPoint)) {
      console.log('Invalid route points', { startPoint, endPoint });
      return;
    }
    
    // Periksa DOM dan peta telah dimuat sepenuhnya
    if (!map) {
      console.log('Map not ready yet');
      return;
    }
    
    // Reset cached routes saat lokasi berubah
    if (prevPropsRef.current.startPoint && prevPropsRef.current.endPoint && 
        (prevPropsRef.current.startPoint[0] !== startPoint[0] || 
         prevPropsRef.current.startPoint[1] !== startPoint[1] ||
         prevPropsRef.current.endPoint[0] !== endPoint[0] ||
         prevPropsRef.current.endPoint[1] !== endPoint[1])) {
      // Reset both ref and state
      availableRoutesRef.current = {
        tollRoute: null,
        nonTollRoute: null
      };
      setAvailableRoutes({
        tollRoute: null,
        nonTollRoute: null
      });
    }
    
    // Ambil rute
    fetchRoute(startPoint, endPoint, transportMode, preferTollRoads);
  }, [startPoint, endPoint, transportMode, map, fetchRoute, preferTollRoads]);

  // Jika tidak ada titik, jangan render apa-apa
  if (!startPoint || !endPoint) {
    return null;
  }
  
  // Jika rute belum dihitung, tampilkan garis langsung antara titik
  if (routeGeometry.length === 0) {
    return (
      <Polyline
        positions={[startPoint, endPoint]}
        color="black"
        weight={4}
        opacity={0.7}
      />
    );
  }
  
  return (
    <>
      {/* Render polyline berdasarkan geometri rute */}
      <Polyline
        positions={routeGeometry}
        color={isTruckRoute ? "#e67e22" : (usesToll ? "#3182CE" : "#1F2937")} // Warna berbeda untuk rute tol
        weight={5}
        opacity={0.7}
      />
      
      {/* Tampilkan peringatan jika ini rute truk dan ada peringatan */}
      {isTruckRoute && truckWarnings.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(230, 126, 34, 0.9)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          zIndex: 1000,
          maxWidth: '300px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          fontSize: '14px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            ⚠️ Peringatan Rute Truk
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {truckWarnings.map((warning, index) => (
              <li key={index} style={{ marginBottom: '6px' }}>
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Tampilkan informasi biaya tol jika tersedia */}
      {usesToll && tollInfo && !isTruckRoute && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(49, 130, 206, 0.9)',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '8px',
          zIndex: 1000,
          maxWidth: '300px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: '14px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
            Biaya Tol: Rp {tollInfo.estimatedCost.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Jarak: {tollInfo.tollDistance.toFixed(1)} km (Golongan {getVehicleClassLabel(tollInfo.vehicleClass)})
          </div>
        </div>
      )}
      
      {/* Tampilkan indikator jalan normal jika rute tidak menggunakan tol */}
      {!usesToll && !isTruckRoute && preferTollRoads === false && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(79, 70, 229, 0.9)',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '8px',
          zIndex: 1000,
          maxWidth: '300px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"></path>
            <path d="m8 6 4-4 4 4"></path>
            <path d="M12 2v10"></path>
            <path d="M8 16h8"></path>
          </svg>
          <div>
            Rute menggunakan jalan non-tol
          </div>
        </div>
      )}
      
      {/* Tampilkan loading indicator */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 15px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          zIndex: 999
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>Mengkalkulasi rute...</span>
        </div>
      )}
      
      {/* Tampilkan error jika ada */}
      {error && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'rgba(231, 76, 60, 0.9)',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '20px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          zIndex: 999
        }}>
          Error: {error}
        </div>
      )}
    </>
  );
};

/**
 * Map transport mode to OSRM profile
 */
const mapTransportModeToOsrmProfile = (mode) => {
  switch (mode) {
    case 'driving-car':
      return 'car';
    case 'driving-hgv':
      return 'car'; // OSRM tidak memiliki profil khusus untuk truk
    case 'cycling-regular':
      return 'bike';
    case 'foot-walking':
      return 'foot';
    default:
      return 'car';
  }
};

/**
 * Extract route instructions from OSRM response
 */
const extractRouteInstructions = (route) => {
  if (!route || !route.legs || route.legs.length === 0) {
    return [];
  }
  
  const instructions = [];
  
  route.legs.forEach(leg => {
    if (leg.steps && leg.steps.length > 0) {
      leg.steps.forEach(step => {
        if (step.maneuver) {
          instructions.push({
            instruction: step.maneuver.instruction || '',
            distance: step.distance,
            duration: step.duration,
            name: step.name || '',
            type: step.maneuver.type || '',
            modifier: step.maneuver.modifier || ''
          });
        }
      });
    }
  });
  
  return instructions;
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {Array} point1 - [lat, lng]
 * @param {Array} point2 - [lat, lng]
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (point1, point2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (point2[0] - point1[0]) * Math.PI / 180;
  const dLon = (point2[1] - point1[1]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // distance in kilometers
};

/**
 * Generate basic instructions for navigation
 * @param {Array} startPoint - Start coordinates [lat, lng]
 * @param {Array} endPoint - End coordinates [lat, lng]
 * @param {String} mode - Transport mode
 * @returns {Array} Array of instruction objects
 */
const generateBasicInstructions = (startPoint, endPoint, mode) => {
  const distance = calculateDistance(startPoint, endPoint);
  
  // Calculate bearing between points (in degrees)
  const y = Math.sin((endPoint[1] - startPoint[1]) * Math.PI / 180) * Math.cos(endPoint[0] * Math.PI / 180);
  const x = Math.cos(startPoint[0] * Math.PI / 180) * Math.sin(endPoint[0] * Math.PI / 180) -
            Math.sin(startPoint[0] * Math.PI / 180) * Math.cos(endPoint[0] * Math.PI / 180) * 
            Math.cos((endPoint[1] - startPoint[1]) * Math.PI / 180);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  
  // Determine direction based on bearing
  let direction;
  if (bearing >= 337.5 || bearing < 22.5) direction = "utara";
  else if (bearing >= 22.5 && bearing < 67.5) direction = "timur laut";
  else if (bearing >= 67.5 && bearing < 112.5) direction = "timur";
  else if (bearing >= 112.5 && bearing < 157.5) direction = "tenggara";
  else if (bearing >= 157.5 && bearing < 202.5) direction = "selatan";
  else if (bearing >= 202.5 && bearing < 247.5) direction = "barat daya";
  else if (bearing >= 247.5 && bearing < 292.5) direction = "barat";
  else direction = "barat laut";
  
  // Adjust average speed based on transport mode
  const avgSpeedKmh = mode === 'driving-hgv' ? 40 : // Truck
                      mode === 'cycling-regular' ? 15 : // Bike
                      mode === 'foot-walking' ? 5 : // Walking
                      50; // Car (default)
  
  // Create basic instructions
  return [
    {
      instruction: `Mulai perjalanan dari titik awal`,
      distance: 0,
      duration: 0,
      type: 'depart',
      modifier: 'straight'
    },
    {
      instruction: `Arah ke ${direction} menuju tujuan`,
      distance: distance * 1000, // Convert to meters for consistency
      duration: (distance / avgSpeedKmh) * 3600, // Estimated seconds based on speed
      type: 'continue',
      modifier: 'straight'
    },
    {
      instruction: `Sampai di tujuan`,
      distance: 0,
      duration: 0,
      type: 'arrive',
      modifier: 'straight'
    }
  ];
};

/**
 * Get toll rate per kilometer based on vehicle class
 */
const getTollRateForClass = (vehicleClass) => {
  // Tarif rata-rata per km di jalan tol Indonesia (Rp)
  switch (vehicleClass) {
    case 1: return 900;   // Golongan I: sedan, jip, pick up, truk kecil
    case 2: return 1350;  // Golongan II: truk dengan 2 gandar
    case 3: return 1800;  // Golongan III: truk dengan 3 gandar
    case 4: return 2250;  // Golongan IV: truk dengan 4 gandar
    case 5: return 2700;  // Golongan V: truk dengan 5 gandar atau lebih
    default: return 900;
  }
};

/**
 * Get vehicle class from truck specifications
 */
const getVehicleClassFromSpecs = (truckSpecs) => {
  if (!truckSpecs) return 2; // Default Golongan II
  
  const { axles } = truckSpecs;
  if (axles === 2) return 2; // Golongan II
  if (axles === 3) return 3; // Golongan III
  if (axles === 4) return 4; // Golongan IV
  if (axles >= 5) return 5; // Golongan V
  
  return 2; // Default Golongan II
};

/**
 * Convert vehicle class to label
 */
const getVehicleClassLabel = (vehicleClass) => {
  switch(vehicleClass) {
    case 1: return "I";
    case 2: return "II";
    case 3: return "III";
    case 4: return "IV";
    case 5: return "V";
    default: return vehicleClass.toString();
  }
};

// Tambahkan animasi spinning untuk loading indicator
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleEl);

export default DetailedRouteMap;