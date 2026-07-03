import type { Category } from "../../../../types/category";

export type FilterType = "" | "deadline" | "importance" | "category";

type Props = {
  categories: Category[];
  filterType: FilterType;
  filterValue: string;
  onChangeType: (type: FilterType) => void;
  onChangeValue: (value: string) => void;
};

const Filter = ({
  categories,
  filterType,
  filterValue,
  onChangeType,
  onChangeValue,
}: Props) => {
  return (
    <div className="flex gap-3">
      <span className="material-symbols-outlined">filter_alt</span>

      {/* 左: フィルターの種類 */}
      <select
        value={filterType}
        onChange={(e) => onChangeType(e.target.value as FilterType)}
        className="bg-white border rounded w-50 px-2"
      >
        <option value="">フィルターなし</option>
        <option value="deadline">期限</option>
        <option value="importance">重要度</option>
        <option value="category">カテゴリー</option>
      </select>

      {/* 右: 選んだ種類に応じた入力 */}
      {filterType === "deadline" && (
        <input
          type="date"
          value={filterValue}
          onChange={(e) => onChangeValue(e.target.value)}
          className="bg-white border rounded w-50 px-2"
        ></input>
      )}
      {filterType === "importance" && (
        <select
          value={filterValue}
          onChange={(e) => onChangeValue(e.target.value)}
          className="bg-white border rounded w-50 px-2"
        >
          <option value="">選択...</option>
          <option value="3">高</option>
          <option value="2">中</option>
          <option value="1">低</option>
        </select>
      )}
      {filterType === "category" && (
        <select
          value={filterValue}
          onChange={(e) => onChangeValue(e.target.value)}
          className="bg-white border rounded w-50 px-2"
        >
          <option value="">選択...</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default Filter;
