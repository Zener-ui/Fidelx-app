import { useState } from "react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Local file-select + thumbnail-preview grid, shared by any flow that
 * collects photos before uploading (dispute evidence, review photos).
 * Doesn't upload anything itself — just manages the local file list;
 * the caller uploads `files.map(f => f.file)` when the surrounding
 * form actually submits.
 */
export default function PhotoPicker({ files, onChange, max = 4, label = "Add photos" }) {
  const handleSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const valid = selected.filter((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) return false;
      if (file.size > MAX_BYTES) return false;
      return true;
    });

    const remaining = max - files.length;
    onChange([...files, ...valid.slice(0, Math.max(0, remaining)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    e.target.value = "";
  };

  const removeFile = (index) => {
    const removed = files[index];
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-2">
          {files.map((file, i) => (
            <div key={`${file.file.name}-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-peach border-2 border-ink">
              <img src={file.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeFile(i)}
                className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-ink text-white" aria-label="Remove photo">
                <span className="text-xs leading-none">×</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {files.length < max && (
        <label className="flex h-16 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-ink bg-white px-2 text-center text-xs font-bold text-ink">
          {label}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleSelect} />
        </label>
      )}
    </div>
  );
}
