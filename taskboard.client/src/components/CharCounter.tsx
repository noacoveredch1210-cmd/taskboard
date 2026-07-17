type Props = {
  current: number;
  max: number;
};

/** 「現在文字数 / 上限」を表示する小さなカウンター。上限が近づくと色で警告する。 */
const CharCounter = ({ current, max }: Props) => {
  const color =
    current >= max
      ? "text-red-500"
      : current >= max * 0.9
        ? "text-amber-600"
        : "text-gray-400";

  return (
    <div
      className={`cursor-default text-xs text-right ${color}`}
    >{`${current}/${max}`}</div>
  );
};

export default CharCounter;
