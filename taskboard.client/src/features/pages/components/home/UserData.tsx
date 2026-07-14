import Avatar from "../../../../components/Avatar";
import type { UserInfo } from "../../../../types/userInfo";

type Props = {
  userInfo: UserInfo;
};

const UserData = ({ userInfo }: Props) => {
  return (
    <div className="flex gap-2 items-center flex-wrap pr-15">
      <Avatar name={userInfo.name} size={36} />
      <h4 className="px-1 text-xl font-medium">{userInfo.name}</h4>
      <span className="px-1 text-gray-500">{userInfo.email}</span>
    </div>
  );
};

export default UserData;
