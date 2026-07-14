import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { boardsApi } from "../api/boards";
import { reportError } from "../hooks/reportError";
import type { BoardMemberDto } from "../api/types";

type Props = {
  boardId: string;
};

const MAX_SHOWN = 5;

/** ボードの参加者アイコンを重ねて並べる（ヘッダー右上の表示用）。 */
const MemberAvatars = ({ boardId }: Props) => {
  const [members, setMembers] = useState<BoardMemberDto[]>([]);

  useEffect(() => {
    boardsApi
      .getMembers(boardId)
      .then(setMembers)
      .catch(reportError("メンバーの取得に失敗しました"));
  }, [boardId]);

  if (members.length === 0) return null;

  const shown = members.slice(0, MAX_SHOWN);
  const overflow = members.length - shown.length;

  return (
    <div className="flex items-center" aria-label="参加者">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <Avatar
            key={m.userId}
            name={m.name}
            size={28}
            title={`${m.name}（${m.role === "owner" ? "オーナー" : "メンバー"}）`}
          />
        ))}
      </div>
      {overflow > 0 && (
        <span className="ml-1 text-sm text-gray-500">+{overflow}</span>
      )}
    </div>
  );
};

export default MemberAvatars;
