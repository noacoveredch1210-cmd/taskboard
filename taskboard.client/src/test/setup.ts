// 各テスト後に jsdom をクリーンアップし、jest-dom のマッチャを有効化する。
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom は <dialog> の showModal を実装しておらず、開かないまま display:none で
// 残る。すると userEvent の可視性チェックでモーダル内を操作できないため、
// 最小限のポリフィルで実際に open させる（close は close イベントも発火する）。
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.show) {
  HTMLDialogElement.prototype.show = function () {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom は window.scrollTo 未実装で警告を出す。モーダルのスクロールロック解除で
// 呼ばれるため、no-op に差し替えてテスト出力のノイズを消す。
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
});
