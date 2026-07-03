import type { UserInfo } from "../../../../types/userInfo";

type Props = {
  userInfo: UserInfo;
};

const UserData = ({ userInfo }: Props) => {
  return (
    <div className="flex gap-2 items-end">
      <span className="material-symbols-outlined">account_circle</span>
      <h4 className="px-1 text-xl font-medium">{userInfo.userName}</h4>
      <span className="px-1 text-gray-500">{userInfo.email}</span>
    </div>
  );
};

export default UserData;
