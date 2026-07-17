import MemberAvatars from "../../components/MemberAvatars";

type props = {
  title: string;
  /** ボードを開いているときの board id。渡すと右上に参加者アイコンを出す。 */
  boardId?: string;
};

const Header = ({ title, boardId }: props) => {
  return (
    <div className="bg-primary-light h-10 flex items-center justify-between px-5 border-b border-b-gray-400">
      <div className="cursor-default font-medium truncate">{title}</div>
      {boardId && <MemberAvatars boardId={boardId} />}
    </div>
  );
};

export default Header;
