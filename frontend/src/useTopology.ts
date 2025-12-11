import { useState, useCallback, useEffect } from 'react';
import { api } from './api';
import type { Topology } from './types';

export function useTopology() {
  const [topologies, setTopologies] = useState<Topology[]>([]);
  const [currentTopology, setCurrentTopology] = useState<Topology | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTopologies = useCallback(async () => {
    setLoading(true);
    try {
      const { topologies } = await api.getTopologies();
      setTopologies(topologies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load topologies');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTopology = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { topology } = await api.getTopology(id);
      setCurrentTopology(topology);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load topology');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTopology = useCallback(async (name: string) => {
    try {
      const { topology } = await api.createTopology(name);
      setTopologies(prev => [...prev, topology]);
      return topology;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create topology');
      throw err;
    }
  }, []);

  const refresh = useCallback(() => {
    if (currentTopology) {
      loadTopology(currentTopology.id);
    }
  }, [currentTopology, loadTopology]);

  useEffect(() => {
    loadTopologies();
  }, [loadTopologies]);

  return {
    topologies,
    currentTopology,
    loading,
    error,
    loadTopology,
    createTopology,
    refresh,
    setError,
  };
}