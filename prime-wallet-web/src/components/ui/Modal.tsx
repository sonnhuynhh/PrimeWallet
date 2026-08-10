import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { AppIcon } from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Mặc định max-w-md như bản cũ; modal swap/quyền cần rộng hơn. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Chặn đóng khi bấm nền / Esc — dùng cho luồng ký đang chạy. */
  dismissible?: boolean;
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const;

/**
 * Bọc Radix Dialog: có sẵn focus trap, khoá scroll, Esc, và aria đúng chuẩn —
 * những thứ bản modal tự viết trước đây thiếu.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  dismissible = true,
}: ModalProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && dismissible) onClose();
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              forceMount
              onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
              onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
              onInteractOutside={(e) => !dismissible && e.preventDefault()}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 18 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
                  'max-h-[85vh] overflow-y-auto rounded-[2rem] border border-[--color-border]',
                  'bg-[--color-surface-1]/95 p-6 shadow-[0_40px_120px_-40px_rgba(252,114,255,0.35)] backdrop-blur-xl',
                  SIZES[size],
                )}
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Dialog.Title className="font-display text-2xl font-extrabold tracking-tight text-white">
                      {title}
                    </Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-sm text-[--color-muted-foreground]">
                        {description}
                      </Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">{title}</Dialog.Description>
                    )}
                  </div>
                  {dismissible ? (
                    <Dialog.Close
                      className="rounded-full p-2 text-[--color-muted-foreground] transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Đóng"
                    >
                      <AppIcon name="lucide:x" size={18} />
                    </Dialog.Close>
                  ) : null}
                </div>

                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
