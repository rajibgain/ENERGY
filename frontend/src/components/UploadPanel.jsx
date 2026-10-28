import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadScheduleCSV } from '../services/api';

export default function UploadPanel({ rooms, onUploadSuccess }) {
  const [selectedRoom, setSelectedRoom] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return showToast('Please select a room.', 'error');
    if (!file) return showToast('Please choose a CSV file.', 'error');

    setUploading(true);
    try {
      const data = await uploadScheduleCSV(selectedRoom, file);
      showToast(data.message || 'Schedule uploaded successfully!', 'success');
      setFile(null);
      setSelectedRoom('');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-card gradient-border p-6 relative">
      <div className="flex items-center gap-2 mb-1">
        <Upload size={18} className="text-neon-green" />
        <h2 className="text-base font-bold text-text-primary">Upload Timetable</h2>
      </div>
      <p className="text-xs text-text-muted mb-5">Upload a CSV schedule to start analysis.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Room Select */}
        <div>
          <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
            Select Room
          </label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary outline-none focus:border-neon/40 focus:ring-1 focus:ring-neon/20 transition-all appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23888' viewBox='0 0 16 16'%3E%3Cpath d='M4.5 6l3.5 4 3.5-4z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
            }}
          >
            <option value="">— Choose a room —</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.block})
              </option>
            ))}
          </select>
        </div>

        {/* Drag & Drop Zone */}
        <div>
          <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
            CSV File
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-neon-green bg-neon-green/5'
                : 'border-border hover:border-neon/30 hover:bg-surface-light'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files.length > 0 && setFile(e.target.files[0])}
              hidden
            />
            <FileUp
              size={32}
              className={`mx-auto mb-2 transition-colors ${isDragging ? 'text-neon-green' : 'text-text-muted'}`}
            />
            <p className="text-sm text-text-secondary">
              Click or drag a <strong className="text-text-primary">.csv</strong> file here
            </p>
            {file && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-semibold text-neon-green mt-2"
              >
                {file.name}
              </motion.p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={uploading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-neon-green/90 to-neon/90 text-background hover:shadow-[0_4px_20px_rgba(0,255,136,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload size={16} />
              Upload Schedule
            </>
          )}
        </motion.button>
      </form>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          className={`absolute bottom-4 left-4 right-4 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-neon-green/10 border border-neon-green/20 text-neon-green'
              : 'bg-neon-red/10 border border-neon-red/20 text-neon-red'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </motion.div>
      )}
    </div>
  );
}
