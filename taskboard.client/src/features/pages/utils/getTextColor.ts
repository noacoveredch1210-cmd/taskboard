// カテゴリーカラーによってテキスト色を変更
export const getTextColor = (bgColor: string) => {
  const c = bgColor.replace("#", "");

  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);

  // 人間の見え方ベースの重み
  const brightness = r * 0.299 + g * 0.587 + b * 0.114;

  return brightness > 186 ? "#000000" : "#ffffff";
};
