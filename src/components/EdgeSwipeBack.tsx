import React, { useRef, useEffect } from "react";

interface EdgeSwipeBackProps {
  onBack: () => void;
  onBeforeSwipePop?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Native iOS-style interactive edge-swipe back gesture wrapper.
 * Supports leading-edge swipes from both left (drag right) and right (drag left)
 * for comfortable one-handed use in both RTL Kurdish and LTR English layouts,
 * running directly on compositor transforms with zero per-frame React re-renders.
 */
export default function EdgeSwipeBack({
  onBack,
  onBeforeSwipePop,
  disabled = false,
  children,
  className = "",
}: EdgeSwipeBackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const onBackRef = useRef(onBack);
  const onBeforeSwipePopRef = useRef(onBeforeSwipePop);

  useEffect(() => {
    onBackRef.current = onBack;
    onBeforeSwipePopRef.current = onBeforeSwipePop;
  }, [onBack, onBeforeSwipePop]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    let active = false;
    let locked: "pending" | "horizontal" | "cancelled" = "pending";
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocityX = 0;
    let edgeSide: "left" | "right" = "left";
    let currentDx = 0;
    let animatingOut = false;

    const resetTransform = (withTransition: boolean) => {
      if (!el) return;
      el.style.transition = withTransition
        ? "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)"
        : "none";
      el.style.transform = "translate3d(0, 0, 0)";
      el.style.willChange = withTransition ? "transform" : "auto";
      if (scrimRef.current) {
        scrimRef.current.style.transition = withTransition
          ? "opacity 180ms cubic-bezier(0.16, 1, 0.3, 1)"
          : "none";
        scrimRef.current.style.opacity = "0";
      }
      if (withTransition) {
        window.setTimeout(() => {
          if (el && !active && !animatingOut) {
            el.style.transition = "";
            el.style.transform = "";
            el.style.willChange = "auto";
          }
        }, 190);
      } else {
        el.style.transform = "";
      }
    };

    const isBlockedTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      if (
        target.closest(
          'input, textarea, select, [data-no-swipe="true"]'
        )
      ) {
        return true;
      }
      let cur: Element | null = target;
      while (cur && cur !== el) {
        if (
          cur.classList.contains("no-scrollbar") &&
          cur.scrollWidth > cur.clientWidth + 4
        ) {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (animatingOut || e.touches.length !== 1) return;
      const docAny = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      if (document.fullscreenElement || docAny.webkitFullscreenElement) return;
      if (isBlockedTarget(e.target)) return;

      const touch = e.touches[0];
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const edgeThreshold = 34;

      if (touch.clientX <= edgeThreshold) {
        edgeSide = "left";
      } else if (touch.clientX >= vw - edgeThreshold) {
        edgeSide = "right";
      } else {
        return;
      }

      active = true;
      locked = "pending";
      startX = touch.clientX;
      startY = touch.clientY;
      lastX = touch.clientX;
      lastT = performance.now();
      velocityX = 0;
      currentDx = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || animatingOut || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rawDx = touch.clientX - startX;
      const rawDy = touch.clientY - startY;

      if (locked === "pending") {
        const absX = Math.abs(rawDx);
        const absY = Math.abs(rawDy);
        if (absX < 7 && absY < 7) return;

        const validDirection =
          (edgeSide === "left" && rawDx > 0) ||
          (edgeSide === "right" && rawDx < 0);

        if (!validDirection || absY > absX * 1.1) {
          locked = "cancelled";
          active = false;
          return;
        }
        locked = "horizontal";
        el.style.willChange = "transform";
        el.style.transition = "none";
        if (scrimRef.current) {
          scrimRef.current.style.transition = "none";
        }
      }

      if (locked === "horizontal") {
        const constrainedDx =
          edgeSide === "left" ? Math.max(0, rawDx) : Math.min(0, rawDx);
        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        velocityX = (touch.clientX - lastX) / dt;
        lastX = touch.clientX;
        lastT = now;
        currentDx = constrainedDx;

        el.style.transform = `translate3d(${constrainedDx}px, 0, 0)`;
        if (scrimRef.current) {
          const vw = window.innerWidth || 390;
          const progress = Math.min(1, Math.abs(constrainedDx) / vw);
          scrimRef.current.style.opacity = String(
            Math.max(0, 0.16 * (1 - progress))
          );
        }
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = () => {
      if (!active || animatingOut) return;
      active = false;
      if (locked !== "horizontal") {
        locked = "pending";
        return;
      }

      const vw = window.innerWidth || 390;
      const absDx = Math.abs(currentDx);
      const directionalVelocity =
        edgeSide === "left" ? velocityX : -velocityX;
      const shouldPop =
        absDx >= Math.min(108, vw * 0.28) ||
        (directionalVelocity >= 0.42 && absDx >= 30);

      if (shouldPop) {
        animatingOut = true;
        const targetX = edgeSide === "left" ? vw : -vw;
        el.style.transition = "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = `translate3d(${targetX}px, 0, 0)`;
        if (scrimRef.current) {
          scrimRef.current.style.transition = "opacity 140ms ease-out";
          scrimRef.current.style.opacity = "0";
        }
        window.setTimeout(() => {
          if (onBeforeSwipePopRef.current) {
            onBeforeSwipePopRef.current();
          }
          onBackRef.current();
        }, 125);
      } else {
        resetTransform(true);
      }
      locked = "pending";
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      resetTransform(false);
    };
  }, [disabled]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        ref={scrimRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-slate-950 opacity-0 -z-10"
      />
      {children}
    </div>
  );
}
