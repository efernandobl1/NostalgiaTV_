import { MatPaginatorIntl } from '@angular/material/paginator';

export function createPaginatorIntl(): MatPaginatorIntl {
  const paginator = new MatPaginatorIntl();
  paginator.itemsPerPageLabel = 'Por página:';
  paginator.nextPageLabel = 'Página siguiente';
  paginator.previousPageLabel = 'Página anterior';
  paginator.firstPageLabel = 'Primera página';
  paginator.lastPageLabel = 'Última página';
  paginator.getRangeLabel = (page, size, total) => {
    if (!total || !size) return `0 de ${total}`;
    const start = page * size;
    return `${start + 1} – ${Math.min(start + size, total)} de ${total}`;
  };
  return paginator;
}
