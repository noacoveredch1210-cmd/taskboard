type props = {
  title: string;
};

const Header = ({ title }: props) => {
  return (
    <div className="bg-primary-light h-10 flex items-center px-5 border-b border-b-gray-400">
      <div className="font-medium">{title}</div>
    </div>
  );
};

export default Header;
