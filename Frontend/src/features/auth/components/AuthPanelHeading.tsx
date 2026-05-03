type AuthPanelHeadingProps = {
  title: string;
  subtitle: string;
};

function AuthPanelHeading({ title, subtitle }: AuthPanelHeadingProps) {
  return (
    <header>
      <p className="auth-heading uppercase">{title}</p>
      <p className="auth-heading">{subtitle}</p>
    </header>
  );
}

export default AuthPanelHeading;
