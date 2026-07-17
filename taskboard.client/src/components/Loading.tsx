import { useEffect, useState } from "react";

/**
 * これを過ぎたら「ただ遅い」のではなく理由がある、とみなす閾値。
 * 通常のロードは 1 秒未満なので、普段は出ない。
 */
const SLOW_AFTER_MS = 4000;

const Loading = () => {
  // サーバーは無料枠で動いており、しばらく使われないと停止する。次のアクセスは
  // 起動から始まるので 30 秒ほど待たされる。黙って回り続けるスピナーは
  // 「壊れている」と受け取られて離脱されるため、遅いときだけ理由を明かす。
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="cursor-default flex h-dvh flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-3">
        <div className="animate-spin h-10 w-10 border-4 border-primary rounded-full border-t-transparent" />
        <div>Now Loading</div>
      </div>
      {isSlow && (
        <p className="max-w-xs text-center text-sm text-gray-500">
          サーバーを起動しています。しばらく使われていないと、初回だけ 30
          秒ほどかかります。
        </p>
      )}
    </div>
  );
};

export default Loading;
