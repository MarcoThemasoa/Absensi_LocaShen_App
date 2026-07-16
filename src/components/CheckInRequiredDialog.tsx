import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { AlertCircle } from 'lucide-react';

interface CheckInRequiredDialogProps {
  open: boolean;
  onClose: () => void;
  onNavigateCheckIn: () => void;
}

export function CheckInRequiredDialog({
  open,
  onClose,
  onNavigateCheckIn,
}: CheckInRequiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <DialogTitle className="text-red-900">Absen Masuk Diperlukan</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Anda harus melakukan absen masuk terlebih dahulu sebelum dapat melakukan absen keluar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button
            onClick={onNavigateCheckIn}
            className="bg-teal-950 hover:bg-teal-900 text-white"
          >
            Absen Masuk Sekarang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
