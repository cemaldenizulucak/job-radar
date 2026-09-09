import { useCallback, useEffect, useState } from 'react';

import { telegramCopy } from '../copy';
import {
  createTelegramLinkCode,
  disconnectTelegram,
  getTelegramStatus,
} from '../services/telegram.service';
import type { TelegramLinkCode, TelegramStatus } from '../types';
import { copyText } from '../utils/copy-text';
import { formatCodeExpiry } from '../utils/telegram-format';

export function useTelegramConnection(enabled: boolean) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [linkCode, setLinkCode] = useState<TelegramLinkCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadStatus = useCallback(async () => {
    if (!enabled) {
      setStatus(null);
      return;
    }

    setIsLoading(true);
    try {
      const next = await getTelegramStatus();
      setStatus(next);
      if (next.connected) {
        setLinkCode(null);
      }
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : telegramCopy.loadError,
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!linkCode) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [linkCode]);

  const createCode = useCallback(async () => {
    if (isCreating) {
      return;
    }
    setIsCreating(true);
    setCopied(false);
    try {
      const next = await createTelegramLinkCode();
      setLinkCode(next);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : telegramCopy.createError,
      );
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  const copyCode = useCallback(async () => {
    if (!linkCode) {
      return;
    }
    try {
      await copyText(linkCode.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [linkCode]);

  const disconnect = useCallback(async () => {
    if (isDisconnecting) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await disconnectTelegram();
      setStatus({
        connected: false,
        displayName: null,
        connectedAt: null,
        botUsername: status?.botUsername ?? null,
      });
      setLinkCode(null);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : telegramCopy.disconnectError,
      );
    } finally {
      setIsDisconnecting(false);
    }
  }, [isDisconnecting, status?.botUsername]);

  return {
    status,
    linkCode,
    error,
    isLoading,
    isCreating,
    isDisconnecting,
    copied,
    expiryLabel: linkCode ? formatCodeExpiry(linkCode.expiresAt, new Date(now)) : null,
    botUsername: linkCode?.botUsername ?? status?.botUsername ?? null,
    loadStatus,
    createCode,
    copyCode,
    disconnect,
  };
}
