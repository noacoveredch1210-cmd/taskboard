import type { TaskInfo } from "./taskInfo";
import type { Position } from "./position";

export type BoardInfo = {
  id: string;
  shortName: string;
  title: string;
  positions: Position[];
  tasks?: TaskInfo[];
};
