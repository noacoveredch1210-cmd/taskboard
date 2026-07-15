import { useCallback, useEffect, useState } from "react";
import ModalBase from "../ModalBase";
import Avatar from "../../../../components/Avatar";
import { boardsApi } from "../../../../api/boards";
import { useAuth } from "../../../../auth/AuthContext";
import { useToast } from "../../../../components/toast/ToastContext";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { BoardMemberDto } from "../../../../api/types";

type Props = {
  boardInfo: BoardInfo;
  onClose: () => void;
  onLeaveBoard: (boardId: string) => Promise<boolean>;
};

/**
 * ボードのメンバー一覧。
 * オーナーは参加リクエストの承認/却下、権限の付与/降格、メンバーの除外ができる。
 * メンバーは自分でこのボードから退出できる。
 */
const MembersModal = ({ boardInfo, onClose, onLeaveBoard }: Props) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<BoardMemberDto[]>([]);
  const [requests, setRequests] = useState<BoardMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 除外の確認対象（inline 確認。ダイアログの入れ子を避ける）
  const [pendingRemove, setPendingRemove] = useState<BoardMemberDto | null>(
    null,
  );
  // 自分の退出の確認中か
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeave = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    // 成功すると Layout がホームへ遷移＆この board を state から除くので、
    // モーダルは閉じる。失敗時は onLeaveBoard 側がトーストを出す。
    const ok = await onLeaveBoard(boardInfo.id);
    setIsLeaving(false);
    if (ok) onClose();
    else setConfirmingLeave(false);
  };

  const isOwner = boardInfo.role === "owner";
  const myId = user?.id;

  // setState は .then/.finally コールバック内に置く（effect 内での同期 setState を避ける）。
  const load = useCallback(() => {
    Promise.all([
      boardsApi.getMembers(boardInfo.id),
      isOwner ? boardsApi.getJoinRequests(boardInfo.id) : Promise.resolve([]),
    ])
      .then(([m, r]) => {
        setMembers(m);
        setRequests(r);
      })
      .catch(() => showToast("メンバー情報の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [boardInfo.id, isOwner, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  /** メンバー操作を実行し、成功したら一覧を取り直す。 */
  const run = async (id: string, action: () => Promise<void>, ng: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await action();
      load();
    } catch {
      showToast(ng);
    } finally {
      setBusyId(null);
    }
  };

  const setRole = (userId: string, role: "owner" | "member") =>
    run(
      userId,
      () => boardsApi.setMemberRole(boardInfo.id, userId, role),
      "権限の変更に失敗しました",
    );

  const confirmRemove = () => {
    const target = pendingRemove;
    if (!target) return;
    setPendingRemove(null);
    run(
      target.userId,
      () => boardsApi.removeMember(boardInfo.id, target.userId),
      "メンバーの除外に失敗しました",
    );
  };

  const approve = (userId: string) =>
    run(
      userId,
      () => boardsApi.approveJoinRequest(boardInfo.id, userId),
      "承認に失敗しました",
    );

  const reject = (userId: string) =>
    run(
      userId,
      () => boardsApi.rejectJoinRequest(boardInfo.id, userId),
      "却下に失敗しました",
    );

  return (
    <ModalBase
      className="p-8 flex flex-col gap-4 w-120 max-w-full"
      onClose={onClose}
    >
      {/* 除外の確認 */}
      {pendingRemove ? (
        <div className="flex flex-col gap-4">
          <div className="font-bold text-red-600">メンバーを外しますか？</div>
          <p className="text-sm text-gray-600">
            {pendingRemove.name} をこのボードから外します。
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPendingRemove(null)}
              className="rounded border hover:bg-gray-100 px-4 py-1"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={confirmRemove}
              className="rounded bg-red-600 text-white hover:bg-red-700 px-4 py-1"
            >
              外す
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 参加リクエスト（オーナーのみ） */}
          {isOwner && requests.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="font-bold">参加リクエスト</div>
              <ul className="flex flex-col gap-2">
                {requests.map((r) => (
                  <li
                    key={r.userId}
                    className="flex items-center gap-2 border rounded px-3 py-2 bg-yellow-50"
                  >
                    <Avatar name={r.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{r.name}</div>
                      <div className="truncate text-xs text-gray-500">
                        {r.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => approve(r.userId)}
                      className="text-xs bg-primary rounded px-2 py-1 hover:bg-primary-hover disabled:opacity-50"
                    >
                      承認
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => reject(r.userId)}
                      className="text-xs border rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                    >
                      却下
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="font-bold">メンバー</div>
          {loading ? (
            <div className="text-sm text-gray-500">読み込み中…</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {members.map((m) => {
                const isSelf = m.userId === myId;
                return (
                  <li
                    key={m.userId}
                    className="flex items-center gap-2 border rounded px-3 py-2"
                  >
                    <Avatar name={m.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">
                        {m.name}
                        {isSelf && (
                          <span className="text-gray-400 text-sm">
                            （あなた）
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {m.email}
                      </div>
                    </div>
                    <span
                      className={`text-xs rounded px-2 py-0.5 ${
                        m.role === "owner"
                          ? "bg-primary-light"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {m.role === "owner" ? "オーナー" : "メンバー"}
                    </span>

                    {/* 役割変更・除外はオーナーが他人に対してのみ */}
                    {isOwner && !isSelf && (
                      <div className="flex items-center gap-1">
                        {m.role === "member" ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => setRole(m.userId, "owner")}
                            className="text-xs border rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                          >
                            オーナーにする
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => setRole(m.userId, "member")}
                            className="text-xs border rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                          >
                            メンバーに戻す
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`${m.name} を外す`}
                          disabled={busyId !== null}
                          onClick={() => setPendingRemove(m)}
                          className="text-xs text-red-600 rounded px-2 py-1 hover:bg-red-50 disabled:opacity-50"
                        >
                          外す
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* メンバー（非オーナー）は自分でこのボードから退出できる */}
          {!isOwner &&
            (confirmingLeave ? (
              <div className="mt-2 flex flex-col gap-3 border-t pt-4">
                <p className="text-sm text-gray-600">
                  このボードから退出しますか？
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmingLeave(false)}
                    disabled={isLeaving}
                    className="rounded border hover:bg-gray-100 px-4 py-1 disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={isLeaving}
                    className="rounded bg-red-600 text-white hover:bg-red-700 px-4 py-1 disabled:opacity-50"
                  >
                    {isLeaving ? "退出中…" : "退出する"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 border-t pt-4 text-right">
                <button
                  type="button"
                  onClick={() => setConfirmingLeave(true)}
                  className="text-sm text-red-600 underline hover:text-red-700"
                >
                  このボードから退出する
                </button>
              </div>
            ))}
        </>
      )}
    </ModalBase>
  );
};

export default MembersModal;
