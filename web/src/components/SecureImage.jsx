import { useEffect, useState } from "react";
import { fetchWithAuth } from "../api.js";

export default function SecureImage({ src, alt, className }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    async function load() {
      if (!src) return;
      try {
        const res = await fetchWithAuth(src);
        if (!res.ok) return;
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        // ignore
      }
    }

    load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!url) return null;
  return <img className={className} src={url} alt={alt} />;
}
