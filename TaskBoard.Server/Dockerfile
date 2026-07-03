# ビルドステージ
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

# プロジェクトファイルだけ先にコピーしてリストア（レイヤーキャッシュを効かせるため）
COPY TaskBoard.Server.csproj .
RUN dotnet restore

# 残りのソースをコピーしてビルド
COPY . .
RUN dotnet publish -c Release -o out

# 実行ステージ
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/out .
ENTRYPOINT ["dotnet", "TaskBoard.Server.dll"]