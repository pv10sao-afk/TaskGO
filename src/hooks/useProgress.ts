import { useEffect, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { defaultUserProgress, getSessions, getUserProgress } from '../services/storage';
import type { Session, UserProgress } from '../types';

export function useProgress() {
  const isFocused = useIsFocused();
  const [progress, setProgress] = useState<UserProgress>(defaultUserProgress);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setLoading(true);

      try {
        const [nextProgress, nextSessions] = await Promise.all([getUserProgress(), getSessions()]);

        if (!isActive) {
          return;
        }

        setProgress(nextProgress);
        setSessions(nextSessions);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    if (isFocused) {
      void load();
    }

    return () => {
      isActive = false;
    };
  }, [isFocused, reloadToken]);

  function refresh() {
    setReloadToken((value) => value + 1);
  }

  return { progress, sessions, loading, refresh };
}
