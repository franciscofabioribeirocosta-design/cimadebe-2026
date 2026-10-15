/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * SWR Cache Provider with strict limit(50) for heavy dashboards (Pillar 3)
 */

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, limit as firestoreLimit, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';

interface SWRQueryOptions {
  collectionName: string;
  constraints?: QueryConstraint[];
  maxLimit?: number;
}

const memoryCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 60000; // 60 seconds TTL

export function useSWRQuery<T = any>({ collectionName, constraints = [], maxLimit = 50 }: SWRQueryOptions) {
  const cacheKey = `${collectionName}_${JSON.stringify(constraints)}_${maxLimit}`;
  
  const [data, setData] = useState<T[]>(() => {
    const cached = memoryCache.get(cacheKey);
    return cached ? cached.data : [];
  });
  const [loading, setLoading] = useState<boolean>(!memoryCache.has(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const fetchedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function revalidate() {
      try {
        const colRef = collection(db, collectionName);
        const finalQuery = query(colRef, ...constraints, firestoreLimit(maxLimit));
        const snap = await getDocs(finalQuery);
        
        const freshData = snap.docs.map(d => ({ ...d.data(), id: d.id })) as T[];
        
        memoryCache.set(cacheKey, { data: freshData, timestamp: Date.now() });

        if (isMounted) {
          setData(freshData);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      }
    }

    const cached = memoryCache.get(cacheKey);
    if (!cached || Date.now() - cached.timestamp > CACHE_TTL) {
      if (!fetchedRef.current) {
        fetchedRef.current = true;
        revalidate();
      }
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [cacheKey]);

  return { data, loading, error };
}
