# ビルドステージ
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

# プロジェクトファイルだけ先にコピーしてリストア（レイヤーキャッシュを効かせるため）
COPY TaskBoard.Server.csproj .
RUN dotnet restore

# 残りのソースをコピーしてビルド（復元済みなので再取得しない）
COPY . .
RUN dotnet publish -c Release -o out --no-restore

# 実行ステージ
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/out .

# root では動かさない（イメージに用意されている非特権ユーザーを使う）。
USER app

# 非 root は 1024 未満のポートを開けないため、既定の 8080 を明示する。
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

# 死活監視は /health と /health/ready をデプロイ先（Render 等）から叩く。
# aspnet イメージには curl も wget も無いため、Dockerfile の HEALTHCHECK は置かない。

ENTRYPOINT ["dotnet", "TaskBoard.Server.dll"]
