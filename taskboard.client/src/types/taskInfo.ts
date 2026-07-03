export type TaskInfo = {
  id: string;
  name: string;
  comment: string;
  importance: number;
  Deadline?: Date;
  // 未設定は空文字 ""
  categoryId: string;
  // 所属する position の id
  positionId: string;
};
