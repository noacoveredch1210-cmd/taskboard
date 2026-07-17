import { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorScreen from "./ErrorScreen";
import { reportError } from "../hooks/reportError";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * 描画中の例外を受け止める最後の砦。
 *
 * これが無いと、どこか 1 箇所で例外が出ただけで React がツリー全体を unmount し、
 * 画面が真っ白になる（利用者には何が起きたか分からず、操作の手段も残らない）。
 * 想定内の失敗（API エラーなど）は各フックが握ってトーストを出すので、ここへ来るのは
 * 想定外のバグだけ。直せる見込みが無い以上、再読み込みの導線だけ渡して諦める。
 *
 * エラー境界は React の仕様上クラスコンポーネントでしか作れない。
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 画面には出さず、開発者向けに残す（componentStack で発生箇所を辿れる）。
    reportError("画面の描画に失敗しました")({ error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          icon="error"
          title="問題が発生しました"
          message="予期しないエラーで画面を表示できませんでした。再読み込みしてください。"
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
