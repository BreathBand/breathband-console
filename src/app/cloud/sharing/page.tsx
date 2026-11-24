"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// /cloud/sharing/ — sharing now lives in Settings, under Coaches and sharing.
// Kept so links (invite emails, older bookmarks) still land in the right place.
export default function SharingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/cloud/account/#coaches");
  }, [router]);
  return null;
}
