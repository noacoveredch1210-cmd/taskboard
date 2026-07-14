type Props = {
  name: string;
  /** 円の直径（Tailwind の size 値ではなく px 指定）。既定 32px。 */
  size?: number;
  title?: string;
};

// 名前から決まる背景色（同じ人はいつも同じ色）。
// アプリのテーマ（セージ/ティール系の primary #4F7C7E に暖色アクセント）に合わせ、
// 彩度を抑えた中間トーンで揃えている。白文字が読める明度に調整済み。
const COLORS = [
  "#4F7C7E", // ティール（primary と同系）
  "#5B7DB1", // くすんだ青
  "#7E6BA6", // 藤紫
  "#9C6E96", // 梅
  "#B4606A", // ローズ
  "#C67B45", // テラコッタ
  "#A98B3E", // 黄土
  "#5F9068", // セージグリーン
];

const colorFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

/** 名前の頭文字を丸い色付きバッジで表示するアバター。 */
const Avatar = ({ name, size = 32, title }: Props) => {
  const initial = [...(name.trim() || "?")][0].toUpperCase();
  return (
    <span
      title={title ?? name}
      aria-label={name}
      className="inline-flex items-center justify-center rounded-full text-white font-medium select-none ring-2 ring-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor: colorFor(name),
      }}
    >
      {initial}
    </span>
  );
};

export default Avatar;
