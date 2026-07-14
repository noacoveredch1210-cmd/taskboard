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
  // 同一 position 内での並び順（分数を許容。両隣の中間値を入れて 1 件だけ更新する）
  orderIndex: number;
};
