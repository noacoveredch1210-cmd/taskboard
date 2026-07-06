import { useEffect, useState } from "react";
import { loadUser } from "../api/board-data";
import { reportError } from "./reportError";
import type { UserInfo } from "../types/userInfo";

/** 認証ユーザー自身の情報を取得して保持するフック。 */
export const useUser = (): UserInfo => {
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", email: "" });

  useEffect(() => {
    loadUser()
      .then(setUserInfo)
      .catch(reportError("ユーザー情報の取得に失敗しました"));
  }, []);

  return userInfo;
};
