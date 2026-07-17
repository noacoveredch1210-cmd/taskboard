type Props = {
  value: string;
  onChange: (value: string) => void;
};

const Search = ({ value, onChange }: Props) => {
  return (
    <div className=" bg-white w-100 rounded flex px-2 py-1 gap-1">
      <span className="cursor-default material-symbols-outlined">search</span>
      <input
        className="w-full focus:outline-none focus:ring-0"
        placeholder="タスク名・コメントで検索..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      ></input>
    </div>
  );
};

export default Search;
