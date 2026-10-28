import { useEffect, useState } from 'react';

/** @returns {[boolean, import('react').Dispatch<import('react').SetStateAction<boolean>>]} */
export default function useNewQuery() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new')) setOpen(true);
  }, []);
  return [open, setOpen];
}