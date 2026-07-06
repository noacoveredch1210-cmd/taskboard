import { useEffect, useState } from "react";
import { loadUser } from "../api/board-data";
import { reportError } from "./reportError";
import type { UserInfo } from "../types/userInfo";

/** ユーザー情報を取得して保持するフック。 */
export const useUser = (userId: string): UserInfo => {
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", email: "" });

  useEffect(() => {
    loadUser(userId)
      .then(setUserInfo)
      .catch(reportError("ユーザー情報の取得に失敗しました"));
  }, [userId]);

  return userInfo;
};
