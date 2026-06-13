/**
 * Local notification service.
 *
 * Responsibilities:
 * - Request notification permissions (iOS + Android)
 * - Schedule local notifications for new messages
 * - Handle notification tap to navigate to the conversation
 * - Provide an observable current permission status
 *
 * Uses expo-notifications for push notification display,
 * and expo-notifications' addNotificationResponseReceivedListener
 * for tap-to-navigate handling.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────

export interface NotificationMessage {
  conversationId: string;
  title: string;
  body: string;
  senderName?: string;
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

type NavigationHandler = (conversationId: string) => void;

// ── Configure notification display behaviour ──────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Service ────────────────────────────────────────────────────────

class NotificationService {
  private _permissionStatus: PermissionStatus = 'undetermined';
  private _navigationHandler: NavigationHandler | null = null;
  private _responseListener: Notifications.EventSubscription | null = null;
  private _initCalled = false;

  /**
   * Initialise the notification service.
   *
   * Should be called once at app startup (App.tsx).
   * - Requests permissions
   * - Creates Android notification channel
   * - Registers the tap-to-navigate listener
   */
  async init(navigationHandler: NavigationHandler): Promise<void> {
    if (this._initCalled) return;
    this._initCalled = true;

    this._navigationHandler = navigationHandler;

    // Android: create notification channel (required for Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 50, 100],
        lightColor: '#FF7A00',
      });
    }

    // Request permissions
    await this.refreshPermissions();

    // Register tap-to-navigate listener
    this._responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, any>;
        const convId = data?.conversationId as string | undefined;
        if (convId && this._navigationHandler) {
          this._navigationHandler(convId);
        }
      },
    );

    logger.info('[NotificationService] Initialised');
  }

  /** Refresh current permission status from the OS. */
  async refreshPermissions(): Promise<PermissionStatus> {
    const { status } = await Notifications.requestPermissionsAsync();
    this._permissionStatus = status === 'granted' ? 'granted' : 'denied';
    return this._permissionStatus;
  }

  /** Get the current cached permission status. */
  getPermissionStatus(): PermissionStatus {
    return this._permissionStatus;
  }

  /**
   * Display a local notification for a new incoming message.
   *
   * Called by the socket event handler when the app is in background.
   */
  async showMessageNotification(msg: NotificationMessage): Promise<void> {
    if (this._permissionStatus !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        data: { conversationId: msg.conversationId },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'messages' } : {}),
      },
      trigger: null, // immediate
    });
  }

  /** Schedule a notification at a future time (e.g. reminder). */
  async scheduleReminder(
    title: string,
    body: string,
    secondsFromNow: number,
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {},
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'messages' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
      },
    });
    return id;
  }

  /** Cancel a specific scheduled notification by ID. */
  async cancelScheduled(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  /** Get all notification permissions. */
  async getPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
    return Notifications.getPermissionsAsync();
  }

  /** Clean up the listener. */
  destroy(): void {
    if (this._responseListener) {
      this._responseListener.remove();
      this._responseListener = null;
    }
    this._navigationHandler = null;
    this._initCalled = false;
  }
}

export const notificationService = new NotificationService();
