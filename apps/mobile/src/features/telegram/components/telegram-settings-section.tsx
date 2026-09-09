import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { SectionCard } from '@/components/section-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';
import { useTheme } from '@/hooks/use-theme';
import { ConfirmDialog } from '@/features/searches/components/confirm-dialog';

import { telegramCopy } from '../copy';
import { useTelegramConnection } from '../hooks/useTelegramConnection';
import { telegramBotUrl } from '../utils/telegram-format';

type TelegramSettingsSectionProps = {
  enabled: boolean;
};

export function TelegramSettingsSection({ enabled }: TelegramSettingsSectionProps) {
  const theme = useTheme();
  const telegram = useTelegramConnection(enabled);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const botUrl = telegramBotUrl(telegram.botUsername);
  const connected = telegram.status?.connected === true;

  return (
    <SectionCard title={telegramCopy.sectionTitle}>
      {telegram.error ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {telegram.error}
        </ThemedText>
      ) : null}

      {connected ? (
        <>
          <ThemedText type="cardTitle">{telegramCopy.connected}</ThemedText>
          {telegram.status?.displayName ? (
            <ThemedText type="meta" themeColor="textSecondary">
              {telegram.status.displayName}
            </ThemedText>
          ) : null}
          <AppButton
            label={telegramCopy.disconnect}
            variant="danger"
            loading={telegram.isDisconnecting}
            disabled={!enabled}
            onPress={() => setConfirmOpen(true)}
          />
        </>
      ) : (
        <>
          <ThemedText type="meta" themeColor="textSecondary">
            {telegramCopy.disconnectedHint}
          </ThemedText>
          <AppButton
            label={telegram.isCreating ? telegramCopy.connecting : telegramCopy.connect}
            loading={telegram.isCreating}
            disabled={!enabled}
            onPress={() => {
              void telegram.createCode();
            }}
          />
          {telegram.linkCode ? (
            <View style={styles.codeBox}>
              <ThemedText type="cardTitle" selectable>
                {telegram.linkCode.code}
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {telegramCopy.instruction}
              </ThemedText>
              {telegram.expiryLabel ? (
                <ThemedText type="meta" themeColor="textSecondary">
                  {telegram.expiryLabel}
                </ThemedText>
              ) : null}
              <AppButton
                label={telegram.copied ? telegramCopy.copied : telegramCopy.copyCode}
                variant="secondary"
                onPress={() => {
                  void telegram.copyCode();
                }}
              />
              {botUrl ? (
                <AppButton
                  label={telegramCopy.openBot}
                  variant="ghost"
                  onPress={() => {
                    void Linking.openURL(botUrl);
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <ConfirmDialog
        visible={confirmOpen}
        title={telegramCopy.disconnectTitle}
        message={telegramCopy.disconnectMessage}
        confirmLabel={telegramCopy.disconnect}
        cancelLabel={uiCopy.cancel}
        destructive
        confirmDisabled={telegram.isDisconnecting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void telegram.disconnect();
        }}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    gap: Spacing.two,
  },
});
