import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/icon";
import { getPageTokens } from "@/lib/pagination";

interface PaginationNavProps {
  label: string;
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}

export const PaginationNav = ({
  label,
  onPageChange,
  page,
  totalPages,
}: PaginationNavProps) => (
  <nav aria-label={label} className="pagination">
    <button
      className="button button-secondary"
      disabled={page <= 1}
      onClick={() => {
        onPageChange(page - 1);
      }}
      type="button"
    >
      <Icon icon={ArrowLeft01Icon} /> Previous
    </button>
    <span>
      Page {page} of {Math.max(totalPages, 1)}
    </span>
    <div className="pagination-pages">
      {getPageTokens(totalPages, page).map((pageToken) =>
        typeof pageToken === "number" ? (
          <button
            aria-current={pageToken === page ? "page" : undefined}
            aria-label={`Go to page ${pageToken}`}
            className="button button-secondary pagination-page"
            key={pageToken}
            onClick={() => {
              onPageChange(pageToken);
            }}
            type="button"
          >
            {pageToken}
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="pagination-ellipsis"
            key={pageToken}
          >
            …
          </span>
        )
      )}
    </div>
    <button
      className="button button-secondary"
      disabled={page >= totalPages}
      onClick={() => {
        onPageChange(page + 1);
      }}
      type="button"
    >
      Next <Icon icon={ArrowRight01Icon} />
    </button>
  </nav>
);
