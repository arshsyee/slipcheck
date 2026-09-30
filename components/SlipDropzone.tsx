"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import clsx from "clsx";

export function SlipDropzone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    (f?: File | null) => {
      if (f && f.type.startsWith("image/") && !disabled) onFile(f);
    },
    [onFile, disabled],
  );

  // Paste a screenshot straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) accept(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        accept(e.dataTransfer.files[0]);
      }}
      disabled={disabled}
      className={clsx(
        "group relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-16 text-center transition",
        over ? "border-accent bg-accent/5" : "border-line hover:border-accent/60",
        disabled ? "cursor-not-allowed opacity-60" : "hover:scale-[1.005]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_200px_at_50%_0%,rgba(46,224,127,0.12),transparent)] opacity-0 transition group-hover:opacity-100" />
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-accent ring-1 ring-line">
        <ImageUp size={28} />
      </span>
      <div>
        <div className="text-lg font-medium">Drop your bet slip here</div>
        <div className="mt-1 text-sm text-muted">Click to browse or paste a screenshot (⌘V). PNG, JPG or WEBP.</div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => accept(e.target.files?.[0])}
      />
    </button>
  );
}
