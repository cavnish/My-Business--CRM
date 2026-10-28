import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export default function DeleteButton({ onConfirm, label = 'item', size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const confirmDelete = async (event) => {
    event.preventDefault();
    setDeleting(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      toast({ title: `Could not delete ${label}`, description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        className={size === 'sm'
          ? 'rounded-md p-1.5 text-muted-foreground/70 transition hover:bg-destructive/10 hover:text-destructive'
          : 'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:border-destructive/30 hover:text-destructive'}
        title={`Delete ${label}`}
      >
        <Trash2 className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
        {size !== 'sm' && 'Delete'}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {label}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Linked records stay where they are, but this {label} will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}