import type { ConstraintCheckResult, SuggestedAlternative } from "@shiftsync/shared";
import { AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ViolationListProps {
  result: ConstraintCheckResult;
  onSelectAlternative?: (alternative: SuggestedAlternative) => void;
}

export function ViolationList({ result, onSelectAlternative }: ViolationListProps) {
  if (result.passed && result.warnings.length === 0) {
    return (
      <p className="text-sm text-emerald-700">All scheduling rules pass — no conflicts detected.</p>
    );
  }

  return (
    <div className="space-y-3">
      {result.violations.map((violation, index) => (
        <div
          key={`${violation.rule}-${index}`}
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <Badge variant="destructive" className="mb-1">
              {String(violation.rule).split("_").join(" ")}
            </Badge>
            <p className="text-sm">{violation.message}</p>
          </div>
        </div>
      ))}

      {result.warnings.map((warning, index) => (
        <div
          key={`${warning.rule}-${index}`}
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <Badge variant="warning" className="mb-1">
              {String(warning.rule).split("_").join(" ")}
            </Badge>
            <p className="text-sm">{warning.message}</p>
          </div>
        </div>
      ))}

      {result.suggestedAlternatives.length > 0 && (
        <div className="rounded-md border bg-muted/40 p-3">
          <p className="mb-2 text-sm font-medium">Suggested alternatives</p>
          <div className="space-y-2">
            {result.suggestedAlternatives.map((alternative) => (
              <div key={alternative.staffId} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{alternative.name}</p>
                  <p className="text-xs text-muted-foreground">{alternative.reason}</p>
                </div>
                {onSelectAlternative && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectAlternative(alternative)}
                  >
                    Assign instead
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
