import { useEffect, useRef, useState } from "react";

import type { TicketAction } from "@/api/actions";
import {
  ActionEditPanel,
  canEditAction,
} from "@/components/actions-taken-edit";
import type { ActionInteractionContext } from "@/components/actions-taken-edit";
import { ActionHistory } from "@/components/actions-taken-history";

export const ActionControls = ({
  action,
  context,
}: {
  action: TicketAction;
  context: ActionInteractionContext;
}) => {
  const [mode, setMode] = useState<"Edit" | "Assign" | null>(null);
  const [success, setSuccess] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);
  const staff =
    context.principalRole === "IT Staff" ||
    context.principalRole === "Administrator";

  useEffect(() => {
    if (mode === null && wasEditing.current) {
      triggerRef.current?.focus();
    }
    wasEditing.current = mode !== null;
  }, [mode]);

  return (
    <>
      {staff && canEditAction(action.status, context.currentStatus) ? (
        <div className="form-actions">
          {(["Edit", "Assign"] as const).map((label) => (
            <button
              className="button button-secondary"
              disabled={mode !== null}
              key={label}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setSuccess(false);
                setMode(label);
              }}
              type="button"
            >
              {label} Action Taken #{action.id}
            </button>
          ))}
        </div>
      ) : null}
      {mode === null ? null : (
        <ActionEditPanel
          action={action}
          context={context}
          mode={mode}
          onClose={(saved) => {
            setMode(null);
            setSuccess(saved);
          }}
        />
      )}
      <div aria-live="polite" className="operation-status" role="status">
        {success ? "Action Taken saved successfully." : null}
      </div>
      <ActionHistory actionId={action.id} context={context} />
    </>
  );
};
