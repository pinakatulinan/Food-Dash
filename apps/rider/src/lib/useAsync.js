import { useEffect, useState } from 'react';

/**
 * Runs an async function and tracks its three states, so screens don't each
 * reinvent loading/error/data bookkeeping.
 *
 * `deps` controls when it re-runs, exactly like useEffect. The `active` flag
 * drops results from a stale call — otherwise navigating away mid-request
 * sets state on a screen that's gone.
 */
export function useAsync(run, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    let active = true;
    setState({ data: null, error: null, loading: true });

    run().then(
      (data) => { if (active) setState({ data, error: null, loading: false }); },
      (error) => {
        if (active) setState({ data: null, error: error.message, loading: false });
      },
    );

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
