/**
 * 各テキスト入力の最大文字数。
 * フロントの入力制限（maxLength）とカウンター表示で共有する。
 */
export const TEXT_LIMITS = {
  boardTitle: 30,
  boardShortName: 10,
  positionName: 8,
  categoryName: 30,
  taskName: 40,
  taskComment: 500,
} as const;
