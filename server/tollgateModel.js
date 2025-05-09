// Model sederhana untuk mengakses data gerbang tol dari file JSON
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'tollgates-jawa.json');

/**
 * Mengambil seluruh data gerbang tol dari file JSON dan mengembalikan tarif sesuai golongan kendaraan
 * @param {string} [vehicleClass] Golongan kendaraan (misal: 'gol1', 'gol2', dst), jika tidak diisi maka semua tarif dikembalikan
 * @returns {Array} Array objek gerbang tol
 */
function getAllTollgates(vehicleClass) {
  const data = fs.readFileSync(DATA_PATH, 'utf-8');
  const tollgates = JSON.parse(data);
  if (!vehicleClass) return tollgates;
  // Filter tarif sesuai golongan kendaraan
  return tollgates.map(gate => {
    const tarif = gate.tarif && gate.tarif[vehicleClass] ? gate.tarif[vehicleClass] : null;
    return { ...gate, tarif: tarif };
  });
}

/**
 * Mencari gerbang tol berdasarkan nama (case-insensitive)
 * @param {string} name Nama gerbang tol
 * @returns {Object|null} Objek gerbang tol atau null jika tidak ditemukan
 */
function findTollgateByName(name) {
  const tollgates = getAllTollgates();
  return tollgates.find(gate => gate.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Menghitung biaya tol berdasarkan gerbang masuk, keluar, dan jenis kendaraan
 * @param {string} startGate Nama gerbang masuk
 * @param {string} endGate Nama gerbang keluar
 * @param {string} vehicleType Jenis kendaraan (misal: 'car', 'truck', dst)
 * @returns {number|null} Biaya tol, atau null jika tidak ditemukan
 */
function calculateTollCost(startGate, endGate, vehicleType) {
  // Contoh data biaya tol per ruas dan jenis kendaraan
  // Dalam implementasi nyata, data ini bisa diambil dari database atau file JSON terpisah
  const tollRates = {
    'Tangerang-Merak': { car: 45000, truck: 90000 },
    'Jakarta-Cikampek': { car: 20000, truck: 40000 },
    'Cikopo-Palimanan': { car: 119000, truck: 238000 },
    'Palimanan-Kanci': { car: 12000, truck: 24000 },
    'Kanci-Pejagan': { car: 29000, truck: 58000 },
    'Pejagan-Pemalang': { car: 60000, truck: 120000 },
    'Pemalang-Batang': { car: 39000, truck: 78000 },
    'Batang-Semarang': { car: 75000, truck: 150000 },
    'Semarang-Solo': { car: 75000, truck: 150000 },
    'Solo-Ngawi': { car: 104500, truck: 209000 },
    'Ngawi-Kertosono': { car: 88000, truck: 176000 },
    'Kertosono-Mojokerto': { car: 39000, truck: 78000 },
    'Surabaya-Mojokerto': { car: 39000, truck: 78000 }
  };
  const tollgates = getAllTollgates();
  const start = tollgates.find(g => g.name.toLowerCase() === startGate.toLowerCase());
  const end = tollgates.find(g => g.name.toLowerCase() === endGate.toLowerCase());
  if (!start || !end) return null;
  // Jika ruas sama, ambil tarif ruas tersebut
  if (start.ruas === end.ruas && tollRates[start.ruas] && tollRates[start.ruas][vehicleType]) {
    return tollRates[start.ruas][vehicleType];
  }
  // Jika ruas berbeda, bisa dijumlahkan (sederhana, bisa dikembangkan)
  // Ambil urutan ruas dari start ke end
  const ruasList = [];
  let foundStart = false;
  for (const gate of tollgates) {
    if (gate.name.toLowerCase() === startGate.toLowerCase()) foundStart = true;
    if (foundStart && !ruasList.includes(gate.ruas)) ruasList.push(gate.ruas);
    if (gate.name.toLowerCase() === endGate.toLowerCase()) break;
  }
  let total = 0;
  for (const ruas of ruasList) {
    if (tollRates[ruas] && tollRates[ruas][vehicleType]) {
      total += tollRates[ruas][vehicleType];
    }
  }
  return total > 0 ? total : null;
}

module.exports = {
  getAllTollgates,
  findTollgateByName,
  calculateTollCost
};