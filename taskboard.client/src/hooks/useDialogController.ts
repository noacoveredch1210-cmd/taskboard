import { useEffect, useRef } from "react";

export const useDialogController = (
  dialogRef: React.RefObject<HTMLDialogElement | null>,
  isDismissible: boolean,
  onAttemptClose?: () => void, // 閉じようとした意図を通知
) => {
  // 最新 onAttemptClose を参照
  const onAttemptCloseRef = useRef(onAttemptClose);
  useEffect(() => {
    onAttemptCloseRef.current = onAttemptClose;
  }, [onAttemptClose]);

  // 背景スクロールロック用
  const scrollYRef = useRef(0);
  const lockedRef = useRef(false);

  // pointerdown → click のズレ吸収用
  const pointerDownOutsideRef = useRef(false);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;

    // まだ開いていなければモーダルで開く（多重呼び出しに備え try）
    if (!dlg.open) {
      try {
        dlg.showModal();
      } catch {
        // 既に open の状態や多重 showModal 呼び出しに対する安全弁
      }
    }

    // 初期フォーカス（対応ブラウザのみ）
    dlg.focus?.({ preventScroll: true });

    // 背景スクロールロック（iOS対応: position:fixed法）
    const lockBodyScroll = () => {
      if (lockedRef.current) return;
      lockedRef.current = true;

      scrollYRef.current = window.scrollY;
      const body = document.body;
      const html = document.documentElement as HTMLElement;

      body.style.position = "fixed";
      body.style.top = `-${scrollYRef.current}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";

      // スクロール連鎖（overscroll）を切る
      html.style.overscrollBehavior = "none";
      body.style.overscrollBehavior = "none";
    };

    const unlockBodyScroll = () => {
      if (!lockedRef.current) return;
      lockedRef.current = false;

      const body = document.body;
      const html = document.documentElement as HTMLElement;

      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";

      html.style.overscrollBehavior = "";
      body.style.overscrollBehavior = "";

      // 元の位置へ戻す
      window.scrollTo(0, scrollYRef.current);
    };

    // ダイアログ表示中はロック
    lockBodyScroll();

    // 外判定ユーティリティ
    const isOutside = (x: number, y: number) => {
      const r = dlg.getBoundingClientRect();
      return x < r.left || x > r.right || y < r.top || y > r.bottom;
    };

    // pointerdown で外スタートか記録（フリックでズレた click でも外扱いにする）
    const handlePointerDown = (e: PointerEvent) => {
      if (!dlg.open) return;
      pointerDownOutsideRef.current = isOutside(e.clientX, e.clientY);
    };

    // Backdrop クリック（座標判定）
    const handleBackdropClick = (e: MouseEvent) => {
      if (!isDismissible) return;
      if (!dlg.open) return;

      // キーボード由来の click（Space/Enter）を無視
      if (e.detail === 0) {
        // 次回のためにリセット
        pointerDownOutsideRef.current = false;
        return;
      }

      // バックドロップ（= dialog 自体）に対する click だけを見る安全策
      if (e.target !== dlg) {
        pointerDownOutsideRef.current = false;
        return;
      }

      let outside = isOutside(e.clientX, e.clientY);
      // pointerdown で外だったら click で内側にズレても閉じる
      if (pointerDownOutsideRef.current) outside = true;

      if (outside) {
        onAttemptCloseRef.current?.();
      }
      // 次回のためにリセット
      pointerDownOutsideRef.current = false;
    };

    // Esc（cancel）
    const handleCancel = (e: Event) => {
      // キャプチャ段階で止める（後段のリスナーやグローバル処理より先に握り潰す）
      e.preventDefault();
      e.stopImmediatePropagation();

      if (!isDismissible) {
        // 閉じさせないモード → 何もしない（閉じない）
        return;
      }

      // 閉じられるモード → 明示的に close + onClose
      onAttemptCloseRef.current?.();
    };

    // 予防線: keydown(Escape) でも握りつぶす（非ディスミッシブル時のみ）
    const handleKeydown = (e: KeyboardEvent) => {
      if (!isDismissible && (e.key === "Escape" || e.key === "Esc")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    // iOS 向け: バックドロップ側の touchmove を抑止
    // ダイアログ内の「スクロール許可領域」を推定する。
    const scrollableInside = dlg;

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as Node | null;
      const inside =
        scrollableInside && target ? scrollableInside.contains(target) : false;

      if (!inside) {
        // バックドロップ側でのタッチ移動は止める（背面のスクロール連鎖を防ぐ）
        e.preventDefault(); // passive:false が必要（下の addEventListener 参照）
      }
    };

    // ネイティブ close（ボタン・form[method="dialog"]・外部からの close()）でもロック解除
    const handleNativeClose = () => {
      unlockBodyScroll();
    };

    // イベント登録
    dlg.addEventListener("pointerdown", handlePointerDown);
    if (isDismissible) {
      dlg.addEventListener("click", handleBackdropClick);
    }

    // キャプチャ段階で cancel を握りつぶす
    const captureOptions: AddEventListenerOptions = { capture: true };
    dlg.addEventListener("cancel", handleCancel, captureOptions);

    if (!isDismissible) {
      // 非ディスミッシブル時：Escape をさらに強固にブロック
      dlg.addEventListener("keydown", handleKeydown, captureOptions);
    }

    // iOS対策：バックドロップ側のスクロールを止める（preventDefault を効かせるため passive:false）
    dlg.addEventListener("touchmove", handleTouchMove, { passive: false });

    // ダイアログが閉じられたらロック解除
    dlg.addEventListener("close", handleNativeClose);

    // クリーンアップ
    return () => {
      dlg.removeEventListener("pointerdown", handlePointerDown);
      if (isDismissible) {
        dlg.removeEventListener("click", handleBackdropClick);
      }
      dlg.removeEventListener("cancel", handleCancel, captureOptions);

      if (!isDismissible) {
        dlg.removeEventListener("keydown", handleKeydown, captureOptions);
      }

      dlg.removeEventListener("touchmove", handleTouchMove);
      dlg.removeEventListener("close", handleNativeClose);

      // 念のため解除（close イベントを経由しなかった場合）
      unlockBodyScroll();
      // クリック座標フラグをリセット
      pointerDownOutsideRef.current = false;
    };
  }, [dialogRef, isDismissible]);
};
