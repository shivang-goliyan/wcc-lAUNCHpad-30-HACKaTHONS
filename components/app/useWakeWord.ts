'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WakeWord, wakeWordSupported } from '@/lib/client/wakeword';

export type WakeStatus = 'unavailable' | 'off' | 'loading' | 'listening' | 'paused' | 'error';

/**
 * "Hey Nami": while it's on and no voice session is running, the page listens on the device.
 * A detection starts the normal voice loop; when that ends, listening picks up again.
 */
export function useWakeWord({ voiceOn, start }: { voiceOn: boolean; start: () => void }) {
  const [shipped, setShipped] = useState(false);
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState<WakeStatus>('unavailable');
  const ww = useRef<WakeWord | null>(null);
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // only offer it when the model is actually deployed
  useEffect(() => {
    if (!wakeWordSupported()) return;
    let live = true;
    fetch('/wakeword/hey_nami.onnx', { method: 'HEAD' })
      .then((r) => {
        if (!live || !r.ok) return;
        setShipped(true);
        try {
          if (localStorage.getItem('nami_wake') === '1') setOn(true);
        } catch {}
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!shipped || !on || voiceOn) {
      ww.current?.stop();
      ww.current = null;
      return;
    }
    const w = new WakeWord({
      onWake: () => {
        w.stop();
        if (ww.current === w) ww.current = null;
        startRef.current();
      },
    });
    ww.current = w;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- status mirrors the listener we just started
    setStatus('loading');
    w.start()
      .then(() => live && setStatus('listening'))
      .catch(() => live && setStatus('error'));
    // browsers may start audio suspended until the page is touched
    const wake = () => w.resume();
    window.addEventListener('pointerdown', wake);
    return () => {
      live = false;
      window.removeEventListener('pointerdown', wake);
      w.stop();
      if (ww.current === w) ww.current = null;
    };
  }, [shipped, on, voiceOn]);

  const toggle = useCallback(() => {
    setOn((v) => {
      try {
        localStorage.setItem('nami_wake', v ? '0' : '1');
      } catch {}
      return !v;
    });
  }, []);

  const shown: WakeStatus = !shipped ? 'unavailable' : !on ? 'off' : voiceOn ? 'paused' : status;
  return { status: shown, toggle };
}
