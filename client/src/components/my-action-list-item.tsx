import { Link } from "@tanstack/react-router";

import { StatusBadge } from "@/components/status-badge";
import type { MyActionRow } from "@/generated/hey-api/types.gen";
import { formatBangkokDate } from "@/lib/action-format";

interface MyActionListItemProps {
  action: MyActionRow;
  compact?: boolean;
}

export const MyActionListItem = ({
  action,
  compact = false,
}: MyActionListItemProps) => (
  <li className="dashboard-preview-item">
    <div className="dashboard-preview-heading">
      <Link
        className="dashboard-ticket-link"
        hash={`action-${action.id}`}
        params={{ ticketId: action.ticketId.toString() }}
        to="/tickets/$ticketId"
      >
        <span className="dashboard-preview-summary">{action.description}</span>
        <span className="ticket-number">{action.ticket.ticketNumber}</span>
        {compact ? null : (
          <span className="dashboard-preview-ticket">
            {action.ticket.summary}
          </span>
        )}
      </Link>
      <div className="badge-group">
        <StatusBadge kind="status" value={action.ticket.currentStatus} />
        {compact ? null : (
          <StatusBadge kind="owner" value={action.assignee.displayName} />
        )}
      </div>
    </div>
    <p className="dashboard-preview-date">
      Action {action.status}. Updated {formatBangkokDate(action.updatedAt)}
    </p>
  </li>
);
