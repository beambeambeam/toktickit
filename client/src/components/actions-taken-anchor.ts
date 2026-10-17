import { useEffect, useRef, useState } from "react";

import type { TicketActionsPage } from "@/api/actions";

export const actionAnchorId = (actionId: number) => `action-${actionId}`;

export const parseActionAnchor = (hash: string): number | undefined => {
  const match = /^action-(?<id>[1-9]\d*)$/u.exec(hash);
  if (match?.groups?.id === undefined) {
    return undefined;
  }

  const actionId = Number(match.groups.id);
  return Number.isSafeInteger(actionId) ? actionId : undefined;
};

// Walks the Actions Taken pages until the linked action appears, then focuses it.
export const useActionAnchor = ({
  actionPage,
  focusActionId,
  page,
  setPage,
}: {
  actionPage: TicketActionsPage | undefined;
  focusActionId: number | undefined;
  page: number;
  setPage: (page: number) => void;
}) => {
  const [targetId, setTargetId] = useState(focusActionId);
  const [linkedId, setLinkedId] = useState(focusActionId);
  const focusedId = useRef<number | null>(null);

  if (linkedId !== focusActionId) {
    setLinkedId(focusActionId);
    setTargetId(focusActionId);
  }

  const currentPage = actionPage?.page === page ? actionPage : undefined;
  const targetOnPage =
    targetId !== undefined &&
    currentPage !== undefined &&
    currentPage.items.some((action) => action.id === targetId);

  if (
    targetId !== undefined &&
    currentPage !== undefined &&
    !targetOnPage &&
    page < currentPage.totalPages
  ) {
    setPage(page + 1);
  }

  useEffect(() => {
    if (
      !targetOnPage ||
      targetId === undefined ||
      focusedId.current === targetId
    ) {
      return;
    }

    focusedId.current = targetId;
    // Focus also scrolls the action into view.
    document
      .querySelector<HTMLElement>(`#${actionAnchorId(targetId)}`)
      ?.focus();
  }, [targetId, targetOnPage]);

  // A manual page change ends the search for the linked action.
  return (nextPage: number) => {
    setTargetId(undefined);
    setPage(nextPage);
  };
};
