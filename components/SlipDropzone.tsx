"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import clsx from "clsx";

/** Drop, click or paste a slip. Once there's a photo it shows here; drop or click again to swap it. */
export function SlipDropzone({ onFile, disabled, preview }: { onFile: (f: File) => void; disabled?: boolean; preview?: string | null }) {
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
        "flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed text-center",
        preview ? "p-2" : "px-6 py-16",
        over ? "border-accent bg-accent/5" : "border-line",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your slip" className="max-h-48 w-full rounded-lg object-cover object-top lg:max-h-[70vh] lg:object-contain" />
          <span className="text-xs text-muted">Tap or drop to use a different photo</span>
        </>
      ) : (
        <>
          <ImageUp size={28} className="text-accent" />
          <div>
            <div className="font-medium">Drop your bet slip here</div>
            <div className="mt-1 text-sm text-muted">Tap to browse or paste a screenshot (⌘V).</div>
          </div>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = ""; // so picking the same file again still fires
        }}
      />
    </button>
  );
}
