import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  title?: string;
  subtitle?: string;
  infoText?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ 
  isOpen, 
  onClose, 
  imageSrc, 
  title = 'Pratinjau Foto',
  subtitle,
  infoText
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header (Mobile) */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Image Container */}
            <div className="flex-1 bg-slate-100 flex items-center justify-center min-h-[300px] overflow-hidden">
              <img 
                src={imageSrc} 
                alt={title} 
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Sidebar / Info */}
            <div className="w-full md:w-64 p-6 bg-white flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100">
              <div>
                <div className="hidden md:block mb-6">
                  <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
                  {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Informasi</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {infoText || 'Foto ini diambil melalui verifikasi wajah saat melakukan absensi harian.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-2">
                <a 
                  href={imageSrc} 
                  download={`foto_${title.toLowerCase().replace(/\s+/g, '_')}.jpg`}
                  className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" /> Unduh Foto
                </a>
                <button 
                  onClick={() => window.open(imageSrc, '_blank')}
                  className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" /> Buka Tab Baru
                </button>
                <button 
                  onClick={onClose}
                  className="hidden md:block w-full py-2 text-slate-400 text-sm font-medium hover:text-slate-600"
                >
                  Tutup
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ImageModal;
