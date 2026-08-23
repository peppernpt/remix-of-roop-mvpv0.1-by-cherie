import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollText } from "lucide-react";

type RentalPolicyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName: string | null | undefined;
  policyText: string | null | undefined;
  policyImages: string[];
};

/**
 * Full-screen scrollable modal showing the complete Rental Details & Policy
 * text and all policy images. Used by the product detail page and the Bag page
 * so customers can read the full policy before acknowledging it.
 */
export function RentalPolicyModal({
  open,
  onOpenChange,
  storeName,
  policyText,
  policyImages,
}: RentalPolicyModalProps) {
  const store = storeName ?? "this store";
  const hasContent = policyText?.trim() || policyImages.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-medium flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-muted-foreground" />
            Rental Details & Policy
          </DialogTitle>
          <DialogDescription className="text-xs">
            Provided by {store}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {policyText?.trim() ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line mb-4">
              {policyText}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic mb-4">
              No written policy provided.
            </p>
          )}

          {policyImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {policyImages.map((url, idx) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block group"
                >
                  <img
                    src={url}
                    alt={`${store} rental policy ${idx + 1}`}
                    loading="lazy"
                    className="w-full h-32 sm:h-36 rounded-lg border border-border object-cover transition group-hover:opacity-80"
                  />
                </a>
              ))}
            </div>
          )}

          {!hasContent ? (
            <p className="text-sm text-muted-foreground">
              This store has not provided rental details or a policy.
            </p>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-border shrink-0">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RentalPolicyModal;
