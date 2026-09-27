// Shared styles for dashboard items that navigate somewhere when clicked.

/** Stat card rendered as a button — add alongside `stat-card`. */
export const CLICKABLE_CARD = 'group w-full text-left cursor-pointer hover:border-navy-light';

/** List row rendered as a button — bleeds slightly past the card padding so the hover tint has room. */
export const CLICKABLE_ROW = 'w-[calc(100%+1rem)] -mx-2 px-2 text-left rounded-lg cursor-pointer hover:bg-grey-bg transition-colors';

/** Table row that navigates. */
export const CLICKABLE_TR = 'cursor-pointer hover:bg-grey-bg transition-colors';
