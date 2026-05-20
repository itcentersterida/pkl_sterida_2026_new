import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  MapPin, 
  Search, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  X,
  Target,
  Navigation,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  db
} from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapPicker = ({ onLocationSelect, markerPos }: any) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });

  return markerPos ? <Marker position={markerPos} /> : null;
};

const ChangeView = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const LocationManager: React.FC = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [locToDelete, setLocToDelete] = useState<any>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [radius, setRadius] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const geocodeAddress = async (addr: string) => {
    if (addr.length < 5) return;
    setSearching(true);
    try {
      // Nominatim requires a User-Agent to avoid being blocked
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          }
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setLatitude(parseFloat(lat));
        setLongitude(parseFloat(lon));
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddressChange = (val: string) => {
    setAddress(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    // Auto search after 2s of no typing
    searchTimeout.current = setTimeout(() => {
      geocodeAddress(val);
    }, 2000);
  };

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'locations'));
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latitude || !longitude) return;

    setSubmitting(true);
    try {
      const data = {
        name,
        address,
        latitude,
        longitude,
        radius: Number(radius),
        updatedAt: serverTimestamp(),
      };

      if (editingLoc) {
        await updateDoc(doc(db, 'locations', editingLoc.id), data);
      } else {
        await addDoc(collection(db, 'locations'), { ...data, createdAt: serverTimestamp() });
      }

      setShowModal(false);
      resetForm();
      fetchLocations();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!locToDelete) return;

    try {
      await deleteDoc(doc(db, 'locations', locToDelete.id));
      setShowDeleteModal(false);
      setLocToDelete(null);
      fetchLocations();
      alert('Lokasi berhasil dihapus');
    } catch (err: any) {
      console.error('Error deleting location:', err);
      alert(`Gagal menghapus lokasi: ${err.message}`);
    }
  };

  const resetForm = () => {
    setName('');
    setAddress('');
    setLatitude(null);
    setLongitude(null);
    setRadius(50);
    setEditingLoc(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lokasi Magang</h1>
          <p className="text-slate-500">Kelola daftar perusahaan dan radius absensi.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
        >
          <Plus className="w-5 h-5" /> Tambah Lokasi
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white border border-slate-200 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((loc) => (
            <div key={loc.id} className="group bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
              <div className="h-24 bg-slate-50 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                   {/* Simplified map preview or decoration */}
                   <MapPin className="scale-[5] absolute -right-4 -bottom-4 text-slate-300" />
                </div>
                <div className="absolute top-4 right-4 flex gap-2 translate-y-8 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => {
                      setEditingLoc(loc);
                      setName(loc.name);
                      setAddress(loc.address);
                      setLatitude(loc.latitude);
                      setLongitude(loc.longitude);
                      setRadius(loc.radius);
                      setShowModal(true);
                    }}
                    className="p-2 bg-white/20 backdrop-blur-md rounded-lg shadow-sm text-slate-600 hover:bg-white hover:text-indigo-600 transition-all border border-white/30"
                    title="Edit Lokasi"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setLocToDelete(loc);
                      setShowDeleteModal(true);
                    }}
                    className="p-2 bg-white/20 backdrop-blur-md rounded-lg shadow-sm text-slate-600 hover:bg-white hover:text-red-600 transition-all border border-white/30"
                    title="Hapus Lokasi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-900 mb-1">{loc.name}</h3>
                <p className="text-xs text-slate-500 mb-4 line-clamp-2">{loc.address}</p>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-3 h-3 text-brand-secondary" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Radius</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg">{loc.radius}m</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row h-[90vh] md:h-auto max-h-[600px]">
                {/* Left: Map */}
                <div className="w-full md:w-1/2 h-48 md:h-auto bg-slate-100 relative">
                  <MapContainer 
                    center={[latitude || -6.2000, longitude || 106.8166]} 
                    zoom={16} 
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {latitude && longitude && (
                      <ChangeView center={[latitude, longitude]} zoom={16} />
                    )}
                    <MapPicker 
                      onLocationSelect={(latlng: any) => {
                        setLatitude(latlng.lat);
                        setLongitude(latlng.lng);
                      }} 
                      markerPos={latitude && longitude ? [latitude, longitude] : null}
                    />
                    {latitude && longitude && (
                      <Circle center={[latitude, longitude]} radius={radius} pathOptions={{ color: '#4F46E5', fillColor: '#4F46E5', fillOpacity: 0.1 }} />
                    )}
                  </MapContainer>
                  <div className="absolute top-4 left-4 z-[1000]">
                    {searching && (
                      <div className="bg-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-[10px] font-bold text-indigo-600 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Mencari Alamat...
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl border border-slate-200 z-[1000] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Klik pada peta atau ketik alamat di bawah
                  </div>
                </div>

                {/* Right: Form */}
                <div className="w-full md:w-1/2 p-8 overflow-y-auto space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">{editingLoc ? 'Edit Lokasi' : 'Tambah Lokasi'}</h3>
                    <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Perusahaan / Lokasi</label>
                      <input 
                        value={name} 
                        onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/10 outline-none"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alamat Lengkap</label>
                        <button 
                          type="button"
                          onClick={() => geocodeAddress(address)}
                          disabled={searching || address.length < 5}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-30 p-1 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          Cari di Peta
                        </button>
                      </div>
                      <textarea 
                        value={address} 
                        onChange={e => handleAddressChange(e.target.value)}
                        placeholder="Contoh: Jl. Sudirman No. 1, Jakarta"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/10 outline-none h-20 resize-none text-sm"
                        required 
                      />
                      <p className="text-[10px] text-slate-400">Peta akan otomatis mencari koordinat saat Anda selesai mengetik atau klik "Cari di Peta".</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Radius (Mete)</label>
                        <input 
                          type="number"
                          value={radius} 
                          onChange={e => setRadius(Number(e.target.value))}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/10 outline-none"
                          required 
                        />
                      </div>
                      <div className="space-y-1.5 opacity-50">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Koordinat</label>
                        <div className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-mono leading-tight">
                          {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    disabled={submitting || !latitude}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 mt-4 h-14"
                  >
                    {submitting ? 'Menyimpan...' : (editingLoc ? 'Simpan Perubahan' : 'Buat Lokasi')}
                  </button>

                  {!latitude && (
                    <p className="text-[10px] text-center text-amber-600 font-bold uppercase tracking-widest">Pilih titik lokasi pada peta</p>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-6 text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Hapus Lokasi?</h3>
                <p className="text-sm text-slate-500">
                  Apakah Anda yakin ingin menghapus <span className="font-bold text-slate-900">"{locToDelete?.name}"</span>? 
                  Tindakan ini akan mempengaruhi data penempatan siswa yang terkait dengan lokasi ini.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 px-6 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 px-6 text-sm font-bold bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-200"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocationManager;
