'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathname = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pathname === prevPathname.current) return;
    prevPathname.current = pathname;

    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Start progress animation
    setProgress(0);
    setVisible(true);

    // Quickly ramp to ~90%
    let current = 0;
    intervalRef.current = setInterval(() => {
      current += Math.random() * 15 + 5;
      if (current >= 90) {
        current = 90;
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
      setProgress(current);
    }, 80);

    // Navigation is complete (pathname changed), jump to 100%
    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      // Hide after transition completes
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[2px]">
      <div
        className="h-full bg-blue-600 transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
