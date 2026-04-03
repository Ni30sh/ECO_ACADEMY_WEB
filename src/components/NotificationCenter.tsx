import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatTimeAgo } from '@/lib/formatTime';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  notifications: Notification[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount: number;
  userId?: string;
}

const notificationTypeConfig = {
  quiz: { icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950' },
  mission: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950' },
  mission_feedback: { icon: Info, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950' },
  quiz_result: { icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950' },
  role_approval: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950' },
  default: { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted/30' },
};

export default function NotificationCenter({
  notifications,
  isOpen,
  onOpenChange,
  unreadCount,
  userId,
}: NotificationCenterProps) {
  const queryClient = useQueryClient();

  const getTypeConfig = (type: string) => {
    return notificationTypeConfig[type as keyof typeof notificationTypeConfig] || notificationTypeConfig.default;
  };

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);
      queryClient.invalidateQueries({ queryKey: ['nav-notifications', userId] });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    if (!userId) return;
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);
      queryClient.invalidateQueries({ queryKey: ['nav-notifications', userId] });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      queryClient.invalidateQueries({ queryKey: ['nav-notifications', userId] });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <>
      {/* Bell Icon Button */}
      <button
        onClick={() => onOpenChange(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-coral text-white text-[10px] flex items-center justify-center font-bold"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Notification Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
            className="absolute right-0 top-12 w-[min(24rem,calc(100vw-1rem))] rounded-2xl border border-border bg-card shadow-float p-0 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary font-medium hover:underline transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="space-y-0 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <Bell className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground text-center">No notifications yet 🌱</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {notifications.map((notif) => {
                    const config = getTypeConfig(notif.type);
                    const IconComponent = config.icon;
                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ type: 'spring', bounce: 0.2 }}
                        className={`border-b border-border/50 p-4 transition-colors cursor-pointer hover:bg-muted/50 group ${
                          notif.is_read ? 'bg-transparent' : 'bg-jungle-pale/30'
                        }`}
                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                      >
                        <div className="flex gap-3 items-start">
                          <div className={`p-2 rounded-lg ${config.bg} flex-shrink-0`}>
                            <IconComponent className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className={`font-semibold text-sm text-foreground line-clamp-1 ${
                                notif.is_read ? 'font-medium' : 'font-bold'
                              }`}>
                                {notif.title}
                              </p>
                              {!notif.is_read && (
                                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {notif.body}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              {formatTimeAgo(notif.created_at)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissNotification(notif.id);
                            }}
                            className="p-1 rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="Dismiss"
                          >
                            <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
