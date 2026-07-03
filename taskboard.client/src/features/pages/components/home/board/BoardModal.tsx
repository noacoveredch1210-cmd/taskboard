import ModalBase from "../../ModalBase";
import { useState } from "react";
import PositionCard from "./PositionCard";
import type { Position } from "../../../../../types/position";
import BackButton from "../../button/BackButton";
import SaveButton from "../../button/SaveButton";
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

  // つまみ(drag_indicator)でドラッグするので小さめのしきい値
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

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
  const handleDeletePosition = (id: string) => {
    setDraftPositions((prev) => prev.filter((position) => position.id !== id));
  };

  // #endregion

  return (
    <ModalBase className="p-5 flex flex-col gap-3" onClose={onClose}>
      <div className="flex flex-col gap-2">
        <div className="font-medium text-lg">
          {board ? "board 編集" : "board 追加"}
        </div>
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          className="px-3 border rounded min-w-100"
          placeholder="board名を入力..."
        ></input>
        <input
          value={draftShortName}
          onChange={(e) => setDraftShortName(e.target.value)}
          className="px-3 border rounded min-w-100"
          placeholder="board の short name を入力..."
        ></input>
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
                onDeletePosition={handleDeletePosition}
              />
            ))}
          </SortableContext>
        </DndContext>
        {draftPositions.length < 5 && (
          <input
            value={draftPositionName}
            onChange={(e) => setDraftPositionName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-dashed border rounded w-40 text-center"
            placeholder="+ positionを追加"
          ></input>
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
    </ModalBase>
  );
};

export default BoardModal;
