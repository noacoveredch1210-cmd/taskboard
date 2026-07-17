export type TaskInfo = {
  id: string;
  name: string;
  comment: string;
  importance: number;
  deadline?: Date;
  // 未設定は空文字 ""
  categoryId: string;
  // 所属する position の id
  positionId: string;
  // 担当者の user id（未設定は空文字 ""）
  assigneeId: string;
  // order_index は持たない。並び順の値はサーバーが採番するもので、
  // クライアントは配列順で表示し、移動時は「両隣は誰か」だけを送る。
};
