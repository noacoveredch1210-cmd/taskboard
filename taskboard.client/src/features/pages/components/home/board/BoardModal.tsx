import ModalBase from "../../ModalBase";
import { useState } from "react";
import PositionCard from "./PositionCard";
import DeleteModal from "../../modal/DeleteModal";
import type { Position } from "../../../../../types/position";
import BackButton from "../../button/BackButton";
import SaveButton from "../../button/SaveButton";
import CharCounter from "../../../../../components/CharCounter";
import { TEXT_LIMITS } from "../../../../../constants/textLimits";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { BoardInfo } from "../../../../../types/boardInfo";

type Props = {
  onClose: () => void;
  board?: BoardInfo;
  onSetBoard?: (id: string, updates: Partial<BoardInfo>) => void;
  onCreateBoard?: (
    title: string,
    shortName: string,
    positions: Position[],
  ) => void;
};

const BoardModal = ({ onClose, board, onSetBoard, onCreateBoard }: Props) => {
  const [draftTitle, setDraftTitle] = useState(board?.title ?? "");
  const [draftShortName, setDraftShortName] = useState(board?.shortName ?? "");
  const [draftPositions, setDraftPositions] = useState<Position[]>(
    board?.positions ?? [
      { id: crypto.randomUUID(), name: "未処理" },
      { id: crypto.randomUUID(), name: "処理中" },
      { id: crypto.randomUUID(), name: "完了" },
    ],
  );
  const [draftPositionName, setDraftPositionName] = useState("");
  // 削除確認モーダルの対象position(未表示時はnull)
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);

  // つまみ(drag_indicator)でドラッグするので小さめのしきい値
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // 既存boardの編集時、positionの並び順が元から変わったかどうか
  const isReordered =
    !!board &&
    (board.positions.length !== draftPositions.length ||
      board.positions.some((p, i) => p.id !== draftPositions[i]?.id));

  // #region positionの並べ替え
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraftPositions((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };
  // #endregion

  // #region ポジション名の変更
  const handleRenamePosition = (id: string, name: string) => {
    setDraftPositions((prev) =>
      prev.map((position) =>
        position.id === id ? { ...position, name } : position,
      ),
    );
  };
  // #endregion

  // #region エンターキーでポジション追加処理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && draftPositionName.trim()) {
      setDraftPositions((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: draftPositionName },
      ]);
      setDraftPositionName("");
    }
  };
  // #endregion

  // #region ポジション削除
  // 削除ボタン押下時は即削除せず確認モーダルを開く
  const handleRequestDeletePosition = (id: string) => {
    const target = draftPositions.find((position) => position.id === id);
    if (target) setDeleteTarget(target);
  };

  const handleConfirmDeletePosition = () => {
    if (!deleteTarget) return;
    setDraftPositions((prev) =>
      prev.filter((position) => position.id !== deleteTarget.id),
    );
  };

  // 削除対象positionに紐づくタスク数(新規board作成時はtasksが無いので0)
  const deleteTargetTaskCount = deleteTarget
    ? (board?.tasks?.filter((task) => task.positionId === deleteTarget.id)
        .length ?? 0)
    : 0;
  // #endregion

  return (
    <ModalBase className="p-5 flex flex-col gap-3" onClose={onClose}>
      <div className="flex flex-col gap-2">
        <div className="font-medium text-lg">
          {board ? "board 編集" : "board 追加"}
        </div>
        <div>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            maxLength={TEXT_LIMITS.boardTitle}
            className="px-3 border rounded w-full min-w-100"
            placeholder="board名を入力..."
          ></input>
          <CharCounter
            current={draftTitle.length}
            max={TEXT_LIMITS.boardTitle}
          />
        </div>
        <div>
          <input
            value={draftShortName}
            onChange={(e) => setDraftShortName(e.target.value)}
            maxLength={TEXT_LIMITS.boardShortName}
            className="px-3 border rounded w-full min-w-100"
            placeholder="board の short name を入力..."
          ></input>
          <CharCounter
            current={draftShortName.length}
            max={TEXT_LIMITS.boardShortName}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 min-h-60">
        <div className="flex items-center gap-3">
          <div className="font-medium text-lg">position の設定</div>
          <div className="text-sm bg-gray-200 w-10 rounded h-5 flex items-center justify-center">
            {draftPositions.length}
          </div>
          <div>※最大5個</div>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={draftPositions.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {draftPositions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                onRenamePosition={handleRenamePosition}
                onDeletePosition={handleRequestDeletePosition}
              />
            ))}
          </SortableContext>
        </DndContext>
        {draftPositions.length < 5 && (
          <input
            value={draftPositionName}
            onChange={(e) => setDraftPositionName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={TEXT_LIMITS.positionName}
            className="border-dashed border rounded w-40 text-center"
            placeholder="+ positionを追加"
          ></input>
        )}
        {isReordered && (
          <div className="flex items-start gap-1 text-sm text-amber-600">
            <span className="material-symbols-outlined text-base!">warning</span>
            <span>
              position を入れ替えると、現在のタスク配置が崩れる可能性があります。
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <BackButton onClose={onClose} />
        <SaveButton
          onSave={() => {
            if (
              draftTitle.trim() === "" ||
              draftShortName.trim() === "" ||
              draftPositions.length === 0
            )
              return;

            if (board && onSetBoard) {
              // 既存boardの編集
              onSetBoard(board.id, {
                title: draftTitle,
                shortName: draftShortName,
                positions: draftPositions,
              });
            } else if (onCreateBoard) {
              // 新規作成
              onCreateBoard(draftTitle, draftShortName, draftPositions);
            }
          }}
          onClose={onClose}
        />
      </div>
      {deleteTarget && (
        <DeleteModal
          irreversible={false}
          message={
            <>
              <div>「{deleteTarget.name}」を削除しますか？</div>
              {deleteTargetTaskCount > 0 && (
                <div className="mt-1 text-amber-600">
                  この position には {deleteTargetTaskCount}{" "}
                  件のタスクが設定されています。削除すると意図せぬ挙動になる場合があります。
                </div>
              )}
            </>
          }
          onConfirm={handleConfirmDeletePosition}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </ModalBase>
  );
};

export default BoardModal;
