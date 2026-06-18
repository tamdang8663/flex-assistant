"use client";

import { useRef, useState } from "react";

interface UploadZoneProps {
  icon: string;
  title: string;
  subtitle: string;
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

export default function UploadZone({
  icon,
  title,
  subtitle,
  onFiles,
  accept = "image/*",
  multiple = true,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) onFiles(Array.from(e.target.files));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) onFiles(files);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        position: "relative",
        border: `2px dashed ${dragging ? "var(--amber)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: "36px 16px",
        textAlign: "center",
        background: dragging ? "var(--amber-lt)" : "var(--surface)",
        cursor: "pointer",
        transition: "border-color .2s, background .2s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: "none" }}
      />
     
    <div style={{ fontSize: 44, marginBottom: 10 }}>
  {/* icon */}
</div>

      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-1)",
          margin: "0 0 4px",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5, margin: 0 }}>
        {subtitle}
      </p>
    </div>
  );
}
