import { useRef, useState, useEffect, useCallback } from 'react';

const LERP_TAU = 8;
const SNAP = 0.002;
const LRU_MAX = 24;
const LEAD = 24;
const WATCHDOG = 60000;

/**
 * Scroll-tied video scrubbing with WebCodecs frame bank + fallback.
 * Decodes MP4 frames via mp4box + VideoDecoder → canvas for silky scrub.
 * Falls back to video.currentTime seeking if WebCodecs unavailable.
 */
export default function useVideoScrub(videoSrc) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canvasLive, setCanvasLive] = useState(false);

  const s = useRef({
    bank: [],
    lru: new Map(),
    current: 0,
    target: 0,
    dur: 0,
    ready: false,
    reverted: false,
    painted: false,
    building: false,
    seeking: false,
    lastTime: 0,
    raf: null,
  });

  /* ---- progress ---- */
  const getProgress = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 0;
    const range = el.offsetHeight - window.innerHeight;
    return range > 0 ? Math.max(0, Math.min(1, window.scrollY / range)) : 0;
  }, []);

  /* ---- binary search nearest frame ---- */
  const nearestIndex = useCallback((timeMicro) => {
    const bank = s.current.bank;
    if (!bank.length) return -1;
    let lo = 0, hi = bank.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bank[mid].ts < timeMicro) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(bank[lo - 1].ts - timeMicro) < Math.abs(bank[lo].ts - timeMicro)) {
      return lo - 1;
    }
    return lo;
  }, []);

  /* ---- warm LRU cache ---- */
  const warmLRU = useCallback(async (idx) => {
    const st = s.current;
    const toLoad = [];
    for (let i = idx - 1; i <= idx + 2; i++) {
      if (i >= 0 && i < st.bank.length && !st.lru.has(i)) toLoad.push(i);
    }
    await Promise.all(toLoad.map(async (i) => {
      try {
        const bmp = await createImageBitmap(st.bank[i].blob);
        st.lru.set(i, bmp);
      } catch { st.lru.set(i, null); }
    }));
    // evict oldest
    while (st.lru.size > LRU_MAX) {
      const oldest = st.lru.keys().next().value;
      const bmp = st.lru.get(oldest);
      if (bmp) bmp.close();
      st.lru.delete(oldest);
    }
    return st.lru.get(idx) || null;
  }, []);

  /* ---- draw frame on canvas ---- */
  const drawFrame = useCallback(async (timeSec) => {
    const st = s.current;
    const canvas = canvasRef.current;
    if (!canvas || !st.bank.length) return;

    const idx = nearestIndex(timeSec * 1e6);
    if (idx < 0) return;

    let bmp = st.lru.get(idx);
    if (!bmp) bmp = await warmLRU(idx);
    if (!bmp) return;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);

    if (!st.painted) {
      st.painted = true;
      setCanvasLive(true);
    }
  }, [nearestIndex, warmLRU]);

  /* ---- build frame bank (WebCodecs + mp4box) ---- */
  const buildBank = useCallback(async () => {
    const st = s.current;
    if (st.building || st.reverted) return;
    st.building = true;

    // Guard: no WebCodecs
    if (typeof VideoDecoder === 'undefined') {
      st.reverted = true; st.building = false; return;
    }
    // Guard: reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      st.reverted = true; st.building = false; return;
    }

    const watchdog = setTimeout(() => {
      if (!st.ready) { st.reverted = true; setCanvasLive(false); }
    }, WATCHDOG);

    const tryDecode = async (hwAccel) => {
      // Dynamic import mp4box (CJS compat)
      const MP4BoxModule = await import('mp4box');
      const MP4Box = MP4BoxModule.default || MP4BoxModule;

      const resp = await fetch(videoSrc);
      const buffer = await resp.arrayBuffer();

      return new Promise((resolve, reject) => {
        const mp4 = MP4Box.createFile();
        const frames = [];
        const blobPromises = [];
        let totalSamplesQueued = 0;
        let offCanvas = null;

        const decoder = new VideoDecoder({
          output: (frame) => {
            const p = (async () => {
              try {
                if (!offCanvas) offCanvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
                const ctx = offCanvas.getContext('2d');
                ctx.drawImage(frame, 0, 0);
                const blob = await offCanvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
                frames.push({ ts: frame.timestamp, blob });
              } finally {
                frame.close();
              }
            })();
            blobPromises.push(p);
          },
          error: (e) => reject(e),
        });

        mp4.onReady = (info) => {
          const track = info.tracks.find((t) => t.type === 'video');
          if (!track) { reject(new Error('No video track')); return; }

          // Extract codec description
          let description;
          try {
            const trak = mp4.getTrackById(track.id);
            const entry = trak.mdia.minf.stbl.stsd.entries[0];
            const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
            if (box) {
              const DS = globalThis.DataStream || window.DataStream;
              if (DS) {
                const stream = new DS(undefined, 0, DS.BIG_ENDIAN);
                box.write(stream);
                description = new Uint8Array(stream.buffer, 8);
              }
            }
          } catch { /* proceed without description */ }

          decoder.configure({
            codec: track.codec,
            codedWidth: track.video.width,
            codedHeight: track.video.height,
            description,
            hardwareAcceleration: hwAccel,
          });

          mp4.setExtractionOptions(track.id);
          mp4.start();
        };

        mp4.onSamples = (_trackId, _user, samples) => {
          for (const sample of samples) {
            // Throttle decode queue
            if (decoder.decodeQueueSize > LEAD) {
              // Just continue — the queue will drain
            }
            totalSamplesQueued++;
            decoder.decode(new EncodedVideoChunk({
              type: sample.is_sync ? 'key' : 'delta',
              timestamp: (sample.cts * 1e6) / sample.timescale,
              duration: (sample.duration * 1e6) / sample.timescale,
              data: sample.data,
            }));
          }
        };

        mp4.onError = (e) => reject(e);

        buffer.fileStart = 0;
        mp4.appendBuffer(buffer);
        mp4.flush();

        // Wait for decoder to finish, then all blobs
        decoder.flush().then(async () => {
          await Promise.all(blobPromises);
          frames.sort((a, b) => a.ts - b.ts);
          st.bank = frames;
          st.ready = true;
          clearTimeout(watchdog);
          resolve();
        }).catch(reject);
      });
    };

    try {
      await tryDecode('prefer-hardware');
    } catch {
      try {
        await tryDecode('prefer-software');
      } catch {
        st.reverted = true;
        clearTimeout(watchdog);
      }
    }
    st.building = false;
  }, [videoSrc]);

  /* ---- rAF loop ---- */
  useEffect(() => {
    const st = s.current;
    const video = videoRef.current;

    if (video) {
      const onMeta = () => { st.dur = video.duration; };
      const onSeeking = () => { st.seeking = true; };
      const onSeeked = () => { st.seeking = false; };
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('seeking', onSeeking);
      video.addEventListener('seeked', onSeeked);
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const loop = (now) => {
      const dt = Math.min(0.1, (now - (st.lastTime || now)) / 1000);
      st.lastTime = now;

      const p = getProgress();
      setScrollProgress(p);

      if (st.dur > 0) {
        st.target = p * st.dur;

        if (reducedMotion) {
          st.current = st.target;
        } else {
          st.current += (st.target - st.current) * (1 - Math.exp(-dt * LERP_TAU));
          if (Math.abs(st.target - st.current) < SNAP) st.current = st.target;
        }

        if (st.ready && !st.reverted) {
          drawFrame(st.current);
        } else if (video) {
          // Fallback: video.currentTime seeking
          if (!st.seeking && Math.abs(video.currentTime - st.current) > 0.01) {
            video.currentTime = st.current;
          }
        }
      }

      st.raf = requestAnimationFrame(loop);
    };

    st.raf = requestAnimationFrame(loop);

    // Build bank after page load
    const onLoad = () => buildBank();
    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad);
    }

    // Recompute on resize
    const onResize = () => { /* getProgress recalculates automatically */ };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    return () => {
      if (st.raf) cancelAnimationFrame(st.raf);
      window.removeEventListener('load', onLoad);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      st.lru.forEach((bmp) => { if (bmp) bmp.close(); });
      st.lru.clear();
    };
  }, [getProgress, drawFrame, buildBank]);

  return { containerRef, videoRef, canvasRef, scrollProgress, canvasLive };
}
