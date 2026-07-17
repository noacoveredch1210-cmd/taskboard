const Loading = () => {
  return (
    <div className="cursor-default flex h-dvh items-center justify-center gap-3">
      <div className="animate-spin h-10 w-10 border-4 border-primary rounded-full border-t-transparent" />
      <div>Now Loading</div>
    </div>
  );
};

export default Loading;
