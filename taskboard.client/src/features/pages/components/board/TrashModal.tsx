import { useCallback, useEffect, useState } from "react";
import ModalBase from "../ModalBase";
import { loadTrash } from "../../../../api/board-data";
import { tasksApi } from "../../../../api/tasks";
import { useToast } from "../../../../components/toast/ToastContext";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { TaskInfo } from "../../../../types/taskInfo";

type Props = {
  boardInfo: BoardInfo;
  onClose: () => void;
  onRestoreTask: (boardId: string, task: TaskInfo) => Promise<boolean>;
};

/** ゴミ箱（削除済みタスク）。オーナーが復元・完全削除できる。 */
const TrashModal = ({ boardInfo, onClose, onRestoreTask }: Props) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 完全削除の確認対象（inline 確認。ダイアログの入れ子を避ける）
  const [pendingPurge, setPendingPurge] = useState<TaskInfo | null>(null);
  // 「ゴミ箱を空にする」の確認中か
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);

  const load = useCallback(() => {
    loadTrash(boardInfo.id)
      .then(setItems)
      .catch(() => showToast("ゴミ箱の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [boardInfo.id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const removeLocal = (id: string) =>
    setItems((prev) => prev.filter((t) => t.id !== id));

  const handleRestore = async (task: TaskInfo) => {
    if (busyId) return;
    setBusyId(task.id);
    const ok = await onRestoreTask(boardInfo.id, task);
    setBusyId(null);
    if (ok) removeLocal(task.id);
  };

  const confirmPurge = async () => {
    const target = pendingPurge;
    if (!target || busyId) return;
    setPendingPurge(null);
    setBusyId(target.id);
    try {
      await tasksApi.purge(target.id);
      removeLocal(target.id);
    } catch {
      showToast("完全削除に失敗しました");
    } finally {
      setBusyId(null);
    }
  };

  const emptyTrash = async () => {
    if (busyId) return;
    setConfirmingEmpty(false);
    setBusyId("__all__");
    try {
      await tasksApi.purgeAll(boardInfo.id);
      setItems([]);
    } catch {
      showToast("ゴミ箱を空にできませんでした");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ModalBase
      className="p-8 flex flex-col gap-4 w-lg max-w-full"
      onClose={onClose}
    >
      {pendingPurge ? (
        <div className="flex flex-col gap-4">
          <div className="font-bold text-red-600 cursor-default">
            完全に削除しますか？
          </div>
          <p className="text-sm text-gray-600 cursor-default">
            「{pendingPurge.name}」を完全に削除します。元には戻せません。
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPendingPurge(null)}
              className="cursor-pointer rounded border hover:bg-gray-100 px-4 py-1"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={confirmPurge}
              className="cursor-pointer rounded bg-red-600 text-white hover:bg-red-700 px-4 py-1"
            >
              完全に削除
            </button>
          </div>
        </div>
      ) : confirmingEmpty ? (
        <div className="flex flex-col gap-4">
          <div className="cursor-default font-bold text-red-600">
            ゴミ箱を空にしますか？
          </div>
          <p className="cursor-default text-sm text-gray-600">
            ゴミ箱のタスクをすべて完全に削除します。元には戻せません。
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmingEmpty(false)}
              className="cursor-pointer rounded border hover:bg-gray-100 px-4 py-1"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={emptyTrash}
              className="cursor-pointer rounded bg-red-600 text-white hover:bg-red-700 px-4 py-1"
            >
              すべて削除
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="font-bold cursor-default">ゴミ箱</div>
            {!loading && items.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmingEmpty(true)}
                className="cursor-pointer text-sm text-red-600 hover:text-red-700"
              >
                ゴミ箱を空にする
              </button>
            )}
          </div>
          {loading ? (
            <div className="cursor-default text-sm text-gray-500">
              読み込み中…
            </div>
          ) : items.length === 0 ? (
            <div className="cursor-default text-sm text-gray-500">
              ゴミ箱は空です。
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2 border rounded px-3 py-2"
                >
                  <span className="cursor-default min-w-0 flex-1 truncate">
                    {task.name}
                  </span>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => handleRestore(task)}
                    className="cursor-pointer text-xs border rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                  >
                    元に戻す
                  </button>
                  <button
                    type="button"
                    aria-label={`${task.name} を完全に削除`}
                    disabled={busyId !== null}
                    onClick={() => setPendingPurge(task)}
                    className="cursor-pointer text-xs text-red-600 rounded px-2 py-1 hover:bg-red-50 disabled:opacity-50"
                  >
                    完全に削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </ModalBase>
  );
};

export default TrashModal;
