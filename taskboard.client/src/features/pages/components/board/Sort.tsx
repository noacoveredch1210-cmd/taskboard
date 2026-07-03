export type SortKey =
  | ""
  | "deadline-asc"
  | "deadline-desc"
  | "importance-desc"
  | "importance-asc"
  | "category";

type Props = {
  value: SortKey;
  onChange: (value: SortKey) => void;
};

const Sort = ({ value, onChange }: Props) => {
  return (
    <div className="flex gap-3">
      <span className="material-symbols-outlined">sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="bg-white border rounded w-50 px-2"
      >
        <option value="">並び替えなし</option>
        <option value="deadline-asc">期限-早</option>
        <option value="deadline-desc">期限-遅</option>
        <option value="importance-desc">重要度-高</option>
        <option value="importance-asc">重要度-低</option>
        <option value="category">カテゴリー</option>
      </select>
    </div>
  );
};

export default Sort;
