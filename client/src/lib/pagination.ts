export type PageToken = number | "ellipsis-before" | "ellipsis-after";

export const getPageTokens = (
  totalPages: number,
  currentPage: number
): PageToken[] => {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const firstVisiblePage = Math.max(2, currentPage - 1);
  const lastVisiblePage = Math.min(totalPages - 1, currentPage + 1);
  const pages: PageToken[] = [1];

  if (firstVisiblePage > 2) {
    pages.push("ellipsis-before");
  }

  for (
    let pageNumber = firstVisiblePage;
    pageNumber <= lastVisiblePage;
    pageNumber += 1
  ) {
    pages.push(pageNumber);
  }

  if (lastVisiblePage < totalPages - 1) {
    pages.push("ellipsis-after");
  }

  pages.push(totalPages);
  return pages;
};
