import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const REQUEST_POLICY_TITLE = "Request Policy";

export const REQUEST_POLICY_BODY = [
  "For this MVP test, ROOP does not automatically process item changes, cancellations, or refunds.",
  "If you need to change, cancel, or refund a request after sending it, please discuss directly with the store via chat.",
  "If you want to change the rented item, you will need to create a new booking request through ROOP.",
  "More detailed terms and policies will be added in future versions.",
] as const;

interface RequestPolicyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RequestPolicyModal = ({ open, onOpenChange }: RequestPolicyModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{REQUEST_POLICY_TITLE}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-1 text-sm text-muted-foreground">
              {REQUEST_POLICY_BODY.map((paragraph, index) => (
                <p key={index} className="text-red-500">
                  {paragraph}
                </p>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" className="w-full sm:w-auto">
              I understand
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestPolicyModal;
