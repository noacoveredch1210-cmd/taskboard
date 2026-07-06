import type { Position } from "../../../../../types/position";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TEXT_LIMITS } from "../../../../../constants/textLimits";

type Props = {
  position: Position;
  onRenamePosition: (id: string, name: string) => void;
  onDeletePosition: (id: string) => void;
};

const PositionCard = ({
  position,
  onRenamePosition,
  onDeletePosition,
}: Props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: position.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="px-2 border rounded w-40 flex items-center justify-between bg-white"
    >
      {/* このつまみを持つとドラッグできる */}
      <span
        {...attributes}
        {...listeners}
        className="material-symbols-outlined text-sm! cursor-grab touch-none"
      >
        drag_indicator
      </span>
      {/* カードを書き換えて名前変更 */}
      <input
        value={position.name}
        onChange={(e) => onRenamePosition(position.id, e.target.value)}
        maxLength={TEXT_LIMITS.positionName}
        className="min-w-0 flex-1 text-center bg-transparent focus:outline-none"
        placeholder="position名"
      />
      <button onClick={() => onDeletePosition(position.id)}>
        <span className="material-symbols-outlined text-sm!">close</span>
      </button>
    </div>
  );
};

export default PositionCard;
