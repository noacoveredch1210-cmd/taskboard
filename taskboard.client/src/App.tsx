import "./App.css";
import Layout from "./Layout";
import LoginPage from "./auth/LoginPage";
import { useAuth } from "./auth/AuthContext";

function App() {
  const { loading, session } = useAuth();

  // セッション復元中は何も出さない（ログイン画面のちらつき防止）
  if (loading) return null;

  if (!session) return <LoginPage />;

  return <Layout />;
}

export default App;
