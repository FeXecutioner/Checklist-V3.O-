import React from 'react';
import { X, Download } from 'lucide-react';

interface LightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.download = `Chart_Record_${Date.now()}.png`;
    link.href = imageUrl;
    link.click();
  };

  return (
    <div
      id="lightbox"
      onClick={onClose}
      className="fixed inset-0 bg-[#09090b]/95 z-[10000] p-4 sm:p-8 overflow-y-auto flex flex-col items-center justify-center backdrop-blur-2xl transition-opacity duration-200"
    >
      <div className="fixed top-5 right-5 flex gap-3 z-[10001]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-2 font-mono text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-lg backdrop-blur-md"
        >
          <Download size={15} className="text-teal-400" />
          <span>SAVE PHOTO</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 font-mono text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)]"
        >
          <X size={16} />
          <span>CLOSE [ESC]</span>
        </button>
      </div>

      <div className="max-w-5xl w-full flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt="Enlarged Chart Snapshot"
          className="max-w-full max-h-[85vh] object-contain border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl"
        />
      </div>
    </div>
  );
};
