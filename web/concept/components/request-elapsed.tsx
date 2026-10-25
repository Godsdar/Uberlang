import { useEffect, useState } from 'react'

/** Elapsed time is not completion progress. Keep ticking text out of live regions. */
export function RequestElapsed() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const timer = setInterval(() => setSeconds(Math.floor((performance.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span className="lp-request-elapsed" aria-live="off">{seconds}s elapsed</span>
}
