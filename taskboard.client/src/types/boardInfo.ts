import type { TaskInfo } from "./taskInfo";
import type { Position } from "./position";
import type { Category } from "./category";

export type BoardRole = "owner" | "member";

export type BoardInfo = {
  id: string;
  shortName: string;
  title: string;
  /** 自分のこのボードでの役割。owner はボード削除・共有・メンバー管理ができる。 */
  role: BoardRole;
  positions: Position[];
  /** このボードのカテゴリー（ボード単位で共有される）。 */
  categories: Category[];
  tasks?: TaskInfo[];
};
